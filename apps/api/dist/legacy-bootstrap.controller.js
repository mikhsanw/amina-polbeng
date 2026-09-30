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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyBootstrapController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const prisma_service_1 = require("./prisma.service");
const ACTIVE_ROLE_CODES = [
    "SUPER_ADMIN",
    "ADMIN_MUTU",
    "P4MP",
    "AUDITOR",
    "KETUA_AUDITOR",
    "AUDITEE",
    "VERIFIKATOR",
    "PIMPINAN",
];
let LegacyBootstrapController = class LegacyBootstrapController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    workspaceWhere(user) {
        const globalRoles = ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"];
        return user.roleCodes.some((role) => globalRoles.includes(role))
            ? {}
            : {
                OR: [
                    { unitId: user.unitId ?? "__NONE__" },
                    { team: { some: { userId: user.id } } },
                ],
            };
    }
    async bootstrap(user) {
        const [units, roles, modules] = await Promise.all([
            this.prisma.unit.findMany({
                where: { active: true },
                orderBy: { name: "asc" },
            }),
            this.prisma.role.findMany({
                where: { code: { in: ACTIVE_ROLE_CODES } },
                orderBy: { name: "asc" },
            }),
            this.prisma.masterQuestion.groupBy({
                by: ["moduleCode"],
                where: { active: true },
                _count: true,
                orderBy: { moduleCode: "asc" },
            }),
        ]);
        return {
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                roles: user.roleCodes,
                unitId: user.unitId,
                isUnitApprover: user.isUnitApprover,
            },
            units,
            roles,
            modules,
        };
    }
    listPrograms() {
        return this.prisma.auditProgram.findMany({
            include: { _count: { select: { workspaces: true } } },
            orderBy: { startDate: "desc" },
        });
    }
    createProgram(body) {
        return this.prisma.auditProgram.create({
            data: {
                code: body.code,
                name: body.name,
                auditYear: Number(body.auditYear),
                startDate: new Date(body.startDate),
                endDate: new Date(body.endDate),
                status: body.status ?? "DRAFT",
            },
        });
    }
    listEvidences(user) {
        return this.prisma.evidence.findMany({
            where: {
                workspace: { is: this.workspaceWhere(user) },
                deletedAt: null,
            },
            include: {
                workspace: { include: { unit: true } },
                auditQuestion: true,
                uploadedBy: { select: { fullName: true } },
            },
            orderBy: { uploadedAt: "desc" },
            take: 200,
        });
    }
    listAssessments(user) {
        return this.prisma.selfAssessment.findMany({
            where: {
                question: {
                    workspace: { is: this.workspaceWhere(user) },
                },
            },
            include: {
                question: { include: { workspace: { include: { unit: true } } } },
            },
            orderBy: { updatedAt: "desc" },
            take: 200,
        });
    }
    listWorkpapers(user) {
        return this.prisma.workpaper.findMany({
            where: {
                question: {
                    workspace: { is: this.workspaceWhere(user) },
                },
            },
            include: {
                question: { include: { workspace: { include: { unit: true } } } },
                auditor: { select: { fullName: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 200,
        });
    }
    listFindings(user) {
        return this.prisma.finding.findMany({
            where: { workspace: { is: this.workspaceWhere(user) } },
            include: {
                workspace: { include: { unit: true } },
                actions: true,
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });
    }
    listActions(user) {
        return this.prisma.correctiveAction.findMany({
            where: { workspace: { is: this.workspaceWhere(user) } },
            include: {
                finding: true,
                workspace: { include: { unit: true } },
                verifications: true,
            },
            orderBy: { targetDate: "asc" },
            take: 200,
        });
    }
    async workspaceSummary(id, user) {
        const workspace = await this.prisma.auditWorkspace.findFirstOrThrow({
            where: { id, ...this.workspaceWhere(user) },
            include: {
                unit: true,
                team: {
                    include: {
                        user: { select: { id: true, fullName: true, username: true } },
                    },
                },
                _count: {
                    select: {
                        questions: true,
                        evidences: true,
                        findings: true,
                        actions: true,
                    },
                },
            },
        });
        const answered = await this.prisma.selfAssessment.count({
            where: {
                question: { workspaceId: id },
                response: { not: null },
            },
        });
        return { ...workspace, answered };
    }
    questions(query = "", module = "", pageValue = "1", limitValue = "50") {
        const page = Math.max(1, Number(pageValue));
        const take = Math.min(100, Math.max(10, Number(limitValue)));
        const skip = (page - 1) * take;
        const where = { active: true };
        if (module)
            where.moduleCode = module;
        if (query) {
            where.OR = [
                { code: { contains: query } },
                { question: { contains: query } },
            ];
        }
        return Promise.all([
            this.prisma.masterQuestion.findMany({
                where,
                include: { standard: true, isoClause: true },
                orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
                skip,
                take,
            }),
            this.prisma.masterQuestion.count({ where }),
        ]).then(([data, total]) => ({ data, total, page, limit: take }));
    }
};
exports.LegacyBootstrapController = LegacyBootstrapController;
__decorate([
    (0, common_1.Get)("bootstrap"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LegacyBootstrapController.prototype, "bootstrap", null);
__decorate([
    (0, common_1.Get)("audit-programs"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "listPrograms", null);
__decorate([
    (0, common_1.Post)("audit-programs"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "createProgram", null);
__decorate([
    (0, common_1.Get)("evidences"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "listEvidences", null);
__decorate([
    (0, common_1.Get)("assessments"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "listAssessments", null);
__decorate([
    (0, common_1.Get)("workpapers"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "listWorkpapers", null);
__decorate([
    (0, common_1.Get)("findings"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "listFindings", null);
__decorate([
    (0, common_1.Get)("actions"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "listActions", null);
__decorate([
    (0, common_1.Get)("workspaces/:id/summary"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LegacyBootstrapController.prototype, "workspaceSummary", null);
__decorate([
    (0, common_1.Get)("questions"),
    __param(0, (0, common_1.Query)("q")),
    __param(1, (0, common_1.Query)("module")),
    __param(2, (0, common_1.Query)("page")),
    __param(3, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LegacyBootstrapController.prototype, "questions", null);
exports.LegacyBootstrapController = LegacyBootstrapController = __decorate([
    (0, common_1.Controller)("legacy"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LegacyBootstrapController);
//# sourceMappingURL=legacy-bootstrap.controller.js.map