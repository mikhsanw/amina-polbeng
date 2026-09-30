"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAdministrationController = void 0;
const common_1 = require("@nestjs/common");
const argon2_1 = __importDefault(require("argon2"));
const auth_1 = require("./auth");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
let UserAdministrationController = class UserAdministrationController {
    prisma;
    app;
    constructor(prisma, app) {
        this.prisma = prisma;
        this.app = app;
    }
    list() {
        return this.prisma.user.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                status: true,
                mustChangePassword: true,
                failedLoginAttempts: true,
                lockedUntil: true,
                updatedAt: true,
                isUnitApprover: true,
                unit: true,
                roles: { include: { role: true } },
            },
            orderBy: { fullName: "asc" },
        });
    }
    async resetLogin(id, admin) {
        const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
        if (before.deletedAt) {
            throw new common_1.BadRequestException("Akun sudah dihapus.");
        }
        const after = await this.prisma.user.update({
            where: { id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                status: before.status === "LOCKED" ? "ACTIVE" : undefined,
            },
            select: {
                id: true,
                username: true,
                status: true,
                failedLoginAttempts: true,
                lockedUntil: true,
            },
        });
        await this.app.log(admin.id, admin.username, "USER_LOGIN_RESET", "User", id, null, after, {
            failedLoginAttempts: before.failedLoginAttempts,
            lockedUntil: before.lockedUntil?.toISOString() ?? null,
        });
        return after;
    }
    async resetPassword(id, body, admin) {
        const password = String(body.password ?? "");
        if (password.length < 8) {
            throw new common_1.BadRequestException("Password sementara minimal 8 karakter.");
        }
        const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
        if (before.deletedAt) {
            throw new common_1.BadRequestException("Akun sudah dihapus.");
        }
        const passwordHash = await argon2_1.default.hash(password);
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id },
                data: {
                    passwordHash,
                    mustChangePassword: true,
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
            }),
            this.prisma.session.updateMany({
                where: { userId: id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
        await this.app.log(admin.id, admin.username, "USER_PASSWORD_RESET", "User", id, null, { mustChangePassword: true }, { mustChangePassword: before.mustChangePassword });
        return { ok: true, mustChangePassword: true };
    }
    async remove(id, admin) {
        if (id === admin.id) {
            throw new common_1.BadRequestException("Akun yang sedang digunakan tidak dapat dihapus.");
        }
        const before = await this.prisma.user.findUniqueOrThrow({
            where: { id },
            include: { roles: { include: { role: true } } },
        });
        if (before.deletedAt) {
            return {
                ok: true,
                id,
                alreadyDeleted: true,
                deletedAt: before.deletedAt.toISOString(),
            };
        }
        const isSuperAdmin = before.roles.some((mapping) => mapping.role.code === "SUPER_ADMIN");
        if (isSuperAdmin) {
            const activeSuperAdmins = await this.prisma.user.count({
                where: {
                    id: { not: id },
                    status: "ACTIVE",
                    deletedAt: null,
                    roles: { some: { role: { code: "SUPER_ADMIN" } } },
                },
            });
            if (activeSuperAdmins === 0) {
                throw new common_1.BadRequestException("Master Admin terakhir tidak dapat dihapus. Tetapkan Master Admin lain terlebih dahulu.");
            }
        }
        const [workspaceAssignments, planAssignments, workpapers, evidences] = await Promise.all([
            this.prisma.auditTeam.count({ where: { userId: id } }),
            this.prisma.auditUnitPlanAssignment.count({ where: { userId: id } }),
            this.prisma.workpaper.count({ where: { auditorUserId: id } }),
            this.prisma.evidence.count({ where: { uploadedById: id } }),
        ]);
        const deletedAt = new Date();
        const archivedUsername = `deleted_${id}`;
        const result = await this.prisma.$transaction(async (transaction) => {
            const removedPlanAssignments = await transaction.auditUnitPlanAssignment.deleteMany({
                where: { userId: id },
            });
            await transaction.userRole.deleteMany({ where: { userId: id } });
            await transaction.session.deleteMany({ where: { userId: id } });
            await transaction.notification.deleteMany({
                where: { recipientUserId: id },
            });
            const deletedUser = await transaction.user.update({
                where: { id },
                data: {
                    username: archivedUsername,
                    email: null,
                    status: "INACTIVE",
                    deletedAt,
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                    isUnitApprover: false,
                },
                select: {
                    id: true,
                    status: true,
                    deletedAt: true,
                },
            });
            await transaction.activityLog.create({
                data: {
                    userId: admin.id,
                    username: admin.username,
                    action: "USER_DELETED",
                    entityType: "User",
                    entityId: id,
                    workspaceId: null,
                    result: "SUCCESS",
                    oldValue: {
                        username: before.username,
                        email: before.email,
                        status: before.status,
                    },
                    newValue: {
                        status: "INACTIVE",
                        deletedAt: deletedAt.toISOString(),
                        removedPlanAssignments: removedPlanAssignments.count,
                        preservedWorkspaceAssignments: workspaceAssignments,
                        preservedWorkpapers: workpapers,
                        preservedEvidences: evidences,
                    },
                },
            });
            return deletedUser;
        });
        return {
            ok: true,
            id: result.id,
            status: result.status,
            deletedAt: result.deletedAt?.toISOString() ?? deletedAt.toISOString(),
            removedPlanAssignments: planAssignments,
            preservedHistoricalRecords: workspaceAssignments + workpapers + evidences,
        };
    }
};
exports.UserAdministrationController = UserAdministrationController;
__decorate([
    (0, common_1.Get)("users"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UserAdministrationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)("users/:id/reset-login"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "resetLogin", null);
__decorate([
    (0, common_1.Post)("users/:id/reset-password"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Delete)("users/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "remove", null);
exports.UserAdministrationController = UserAdministrationController = __decorate([
    (0, common_1.Controller)("user-admin"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_service_1.AppService])
], UserAdministrationController);
//# sourceMappingURL=user-administration.controller.js.map