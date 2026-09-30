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
exports.NotificationCenterController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const prisma_service_1 = require("./prisma.service");
let NotificationCenterController = class NotificationCenterController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(user) {
        const reviewWorkspaces = await this.prisma.auditWorkspace.findMany({
            where: {
                instrumentStatus: { in: ["AUDITOR_REVIEW", "RETURNED"] },
                team: {
                    some: {
                        userId: user.id,
                        role: { in: ["AUDITOR", "LEAD_AUDITOR"] },
                    },
                },
            },
            include: { unit: true },
        });
        if (reviewWorkspaces.length) {
            const existing = await this.prisma.notification.findMany({
                where: {
                    recipientUserId: user.id,
                    event: "INSTRUMENT_REVIEW_REQUESTED",
                    workspaceId: { in: reviewWorkspaces.map((item) => item.id) },
                },
                select: { workspaceId: true },
            });
            const existingIds = new Set(existing.map((item) => item.workspaceId));
            const missing = reviewWorkspaces.filter((item) => !existingIds.has(item.id));
            if (missing.length) {
                await this.prisma.notification.createMany({
                    data: missing.map((workspace) => ({
                        workspaceId: workspace.id,
                        recipientUserId: user.id,
                        event: "INSTRUMENT_REVIEW_REQUESTED",
                        title: `Telaah instrumen ${workspace.unit.name}`,
                        message: workspace.instrumentStatus === "RETURNED"
                            ? "Instrumen dikembalikan Verifikator dan perlu ditelaah kembali."
                            : "Anda ditugaskan menelaah instrumen pada unit audit ini.",
                        entityType: "AuditWorkspace",
                        entityId: workspace.id,
                    })),
                });
            }
        }
        return this.prisma.notification.findMany({
            where: { recipientUserId: user.id },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    }
    markAllRead(user) {
        return this.prisma.notification.updateMany({
            where: { recipientUserId: user.id, readAt: null },
            data: { readAt: new Date() },
        });
    }
    async markRead(id, user) {
        const item = await this.prisma.notification.findFirst({
            where: { id, recipientUserId: user.id },
        });
        if (!item) {
            throw new common_1.ForbiddenException("Notifikasi tidak ditemukan untuk pengguna ini.");
        }
        return this.prisma.notification.update({
            where: { id },
            data: { readAt: item.readAt ?? new Date() },
        });
    }
};
exports.NotificationCenterController = NotificationCenterController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationCenterController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)("read-all"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationCenterController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Patch)(":id/read"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationCenterController.prototype, "markRead", null);
exports.NotificationCenterController = NotificationCenterController = __decorate([
    (0, common_1.Controller)("notification-center"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationCenterController);
//# sourceMappingURL=notification-center.controller.js.map