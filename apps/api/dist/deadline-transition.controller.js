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
exports.DeadlineTransitionController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
function requiredDate(value, label) {
    const date = new Date(String(value ?? ""));
    if (Number.isNaN(date.getTime())) {
        throw new common_1.BadRequestException(`${label} wajib diisi dan harus valid.`);
    }
    return date;
}
let DeadlineTransitionController = class DeadlineTransitionController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async notifyAdmin(workspaceId, title, message) {
        const admins = await this.flow.prisma.user.findMany({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                roles: { some: { role: { code: "ADMIN_MUTU" } } },
            },
            select: { id: true },
        });
        if (!admins.length)
            return;
        await this.flow.prisma.notification.createMany({
            data: admins.map((admin) => ({
                workspaceId,
                recipientUserId: admin.id,
                event: "SELF_ASSESSMENT_APPROVED",
                title,
                message,
                entityType: "AuditWorkspace",
                entityId: workspaceId,
            })),
        });
    }
    async notifyAuditee(workspaceId, unitId, title, message) {
        const auditees = await this.flow.prisma.user.findMany({
            where: {
                unitId,
                status: "ACTIVE",
                deletedAt: null,
                roles: { some: { role: { code: "AUDITEE" } } },
            },
            select: { id: true },
        });
        if (!auditees.length)
            return;
        await this.flow.prisma.notification.createMany({
            data: auditees.map((auditee) => ({
                workspaceId,
                recipientUserId: auditee.id,
                event: "SELF_ASSESSMENT_OPENED",
                title,
                message,
                entityType: "AuditWorkspace",
                entityId: workspaceId,
            })),
        });
    }
    async activateInstrument(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.instrumentStatus, ["APPROVED"]);
        const plan = await this.flow.prisma.auditUnitPlan.findUnique({
            where: { workspaceId: id },
        });
        if (!plan) {
            throw new common_1.BadRequestException("Rencana audit unit tidak ditemukan.");
        }
        const selfAssessmentEnd = body.selfAssessmentEnd
            ? requiredDate(body.selfAssessmentEnd, "Batas akhir unggah Auditee")
            : plan.selfAssessmentEnd;
        const selfAssessmentReviewEnd = body.selfAssessmentReviewEnd
            ? requiredDate(body.selfAssessmentReviewEnd, "Batas akhir review Auditor")
            : plan.selfAssessmentReviewEnd;
        if (!selfAssessmentEnd || !selfAssessmentReviewEnd) {
            throw new common_1.BadRequestException("Admin Mutu harus menetapkan batas akhir unggah Auditee dan review Auditor sebelum publikasi.");
        }
        if (selfAssessmentReviewEnd.getTime() < selfAssessmentEnd.getTime()) {
            throw new common_1.BadRequestException("Batas review Auditor tidak boleh lebih awal dari batas unggah Auditee.");
        }
        if (workspace.program) {
            const programStart = new Date(workspace.program.startDate);
            const programEnd = new Date(workspace.program.endDate);
            programEnd.setUTCHours(23, 59, 59, 999);
            if (selfAssessmentEnd.getTime() < programStart.getTime() ||
                selfAssessmentReviewEnd.getTime() > programEnd.getTime()) {
                throw new common_1.BadRequestException("Tenggat Auditee dan Auditor harus berada dalam rentang program audit.");
            }
        }
        await this.flow.prisma.auditUnitPlan.update({
            where: { id: plan.id },
            data: {
                selfAssessmentStart: null,
                selfAssessmentEnd,
                selfAssessmentReviewStart: null,
                selfAssessmentReviewEnd,
            },
        });
        const result = await this.flow.publishInstrument(id, user, String(body.note ?? "Instrumen dipublikasikan Admin Mutu."));
        await this.notifyAuditee(id, workspace.unitId, "Self-assessment dibuka", `Instrumen ${workspace.unit.name} telah dipublikasikan. Batas unggah: ${selfAssessmentEnd.toLocaleDateString("id-ID")}.`);
        await this.flow.log(user.id, user.username, "INSTRUMENT_PUBLISHED_WITH_DEADLINES", "AuditWorkspace", id, id, { selfAssessmentEnd, selfAssessmentReviewEnd });
        return { ...result, status: "PUBLISHED" };
    }
    async submitReviewToAdmin(id, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
        const [unresolved, pendingEvidence] = await Promise.all([
            this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: { notIn: ["APPROVED", "RETURNED"] },
                },
            }),
            this.flow.prisma.evidence.count({
                where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
            }),
        ]);
        if (unresolved || pendingEvidence) {
            throw new common_1.BadRequestException(`Review belum lengkap: ${unresolved} butir dan ${pendingEvidence} bukti belum diputuskan.`);
        }
        await this.flow.prisma.auditWorkspace.update({
            where: { id },
            data: { status: "AUDIT" },
        });
        await this.notifyAdmin(id, "Review Auditor menunggu keputusan", `${workspace.unit.name}: review selesai dan menunggu keputusan Admin Mutu.`);
        await this.flow.log(user.id, user.username, "DESK_REVIEW_SUBMITTED_TO_ADMIN", "AuditWorkspace", id, id, { unresolved, pendingEvidence });
        return { ok: true, status: "AUDIT" };
    }
};
exports.DeadlineTransitionController = DeadlineTransitionController;
__decorate([
    (0, common_1.Post)("workspaces/:id/instrument/activate"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeadlineTransitionController.prototype, "activateInstrument", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/field-audit/open"),
    (0, auth_1.Roles)("KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeadlineTransitionController.prototype, "submitReviewToAdmin", null);
exports.DeadlineTransitionController = DeadlineTransitionController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], DeadlineTransitionController);
//# sourceMappingURL=deadline-transition.controller.js.map