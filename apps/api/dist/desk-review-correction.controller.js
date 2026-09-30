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
exports.DeskReviewCorrectionController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
function parseRequiredDate(value, label) {
    const date = new Date(String(value ?? ""));
    if (Number.isNaN(date.getTime())) {
        throw new common_1.BadRequestException(`${label} wajib diisi dan harus valid.`);
    }
    return date;
}
function endOfDay(value) {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
}
let DeskReviewCorrectionController = class DeskReviewCorrectionController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    async plan(workspaceId) {
        const plan = await this.flow.prisma.auditUnitPlan.findUnique({
            where: { workspaceId },
        });
        if (!plan)
            throw new common_1.BadRequestException("Rencana audit unit tidak ditemukan.");
        const program = await this.flow.prisma.auditProgram.findUniqueOrThrow({
            where: { id: plan.programId },
        });
        return { plan, program };
    }
    async notifyAdmins(workspaceId, title, message) {
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
    async reviewEvidence(id, body, user) {
        const evidence = await this.flow.prisma.evidence.findUniqueOrThrow({
            where: { id },
        });
        const workspace = await this.flow.workspace(evidence.workspaceId, user);
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW", "FIELD_AUDIT"]);
        await this.schedule.requireOpen(workspace.id, workspace.status === "FIELD_AUDIT"
            ? "FIELD_AUDIT"
            : "SELF_ASSESSMENT_REVIEW");
        const decision = String(body.decision ?? "").trim().toUpperCase();
        if (!["VALID", "INVALID"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih status bukti Valid atau Tidak Valid.");
        }
        const note = String(body.note ?? "").trim();
        if (decision === "INVALID" && !note) {
            throw new common_1.BadRequestException("Catatan wajib diisi untuk bukti yang tidak valid.");
        }
        const updated = await this.flow.prisma.evidence.update({
            where: { id },
            data: {
                reviewStatus: decision,
                validationNote: note || (decision === "VALID" ? "Bukti sesuai." : null),
                validatedAt: new Date(),
            },
        });
        await this.flow.log(user.id, user.username, decision === "VALID" ? "EVIDENCE_VALIDATED" : "EVIDENCE_INVALIDATED", "Evidence", id, evidence.workspaceId, {
            decision,
            note: note || null,
            phase: workspace.status,
            reassessed: evidence.reviewStatus !== "PENDING",
        });
        return updated;
    }
    async reviewAssessment(id, body, user) {
        const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
            where: { id },
            include: {
                question: {
                    include: {
                        workspace: { include: { team: true } },
                        evidences: { where: { deletedAt: null } },
                    },
                },
            },
        });
        const workspace = assessment.question.workspace;
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        const assignment = workspace.team.find((member) => member.userId === user.id);
        if (!assignment) {
            throw new common_1.BadRequestException("Penugasan Auditor tidak ditemukan.");
        }
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
        await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT_REVIEW");
        const allowedStatuses = assignment.role === "LEAD_AUDITOR"
            ? ["SUBMITTED", "RETURNED", "DESK_ACCEPTED"]
            : ["SUBMITTED"];
        this.flow.requireStatus(assessment.responseStatus, allowedStatuses);
        const decision = String(body.decision ?? "").trim().toUpperCase();
        if (!["ACCEPT", "RETURN"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih keputusan Diterima atau Dikembalikan.");
        }
        const note = String(body.note ?? "").trim();
        if (decision === "RETURN" && !note) {
            throw new common_1.BadRequestException("Catatan pengembalian wajib diisi.");
        }
        const pendingEvidence = assessment.question.evidences.filter((item) => item.reviewStatus === "PENDING").length;
        const invalidEvidence = assessment.question.evidences.filter((item) => item.reviewStatus === "INVALID").length;
        if (pendingEvidence) {
            throw new common_1.BadRequestException(`Masih ada ${pendingEvidence} bukti terkait yang belum diperiksa.`);
        }
        if (decision === "ACCEPT" && invalidEvidence) {
            throw new common_1.BadRequestException(`Masih ada ${invalidEvidence} bukti tidak valid. Ubah bukti menjadi Valid atau tandai butir untuk diperbaiki saat assessment lapangan.`);
        }
        const accepted = decision === "ACCEPT";
        const updated = await this.flow.prisma.selfAssessment.update({
            where: { id },
            data: {
                responseStatus: accepted ? "DESK_ACCEPTED" : "RETURNED",
                approvedById: user.id,
                approvedAt: new Date(),
                returnNote: note || null,
            },
        });
        if (!accepted && assignment.role !== "LEAD_AUDITOR") {
            await this.flow.notifyRole(workspace.id, "LEAD_AUDITOR", "SELF_ASSESSMENT_RETURNED", "Butir ditandai perlu perbaikan lapangan", "Auditor menandai satu butir untuk diperbaiki Auditee saat assessment lapangan.", "SelfAssessment", id);
        }
        await this.flow.log(user.id, user.username, accepted
            ? "SELF_ASSESSMENT_DESK_ACCEPTED"
            : "SELF_ASSESSMENT_FIELD_CORRECTION_REQUIRED", "SelfAssessment", id, workspace.id, {
            decision,
            note: note || null,
            correctionPhase: accepted ? null : "FIELD_AUDIT",
        });
        return updated;
    }
    async submitDeskReview(id, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
        const [unresolved, pendingEvidence, returned, invalidEvidence] = await Promise.all([
            this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: { notIn: ["DESK_ACCEPTED", "RETURNED"] },
                },
            }),
            this.flow.prisma.evidence.count({
                where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
            }),
            this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: "RETURNED",
                },
            }),
            this.flow.prisma.evidence.count({
                where: { workspaceId: id, deletedAt: null, reviewStatus: "INVALID" },
            }),
        ]);
        if (unresolved || pendingEvidence) {
            throw new common_1.BadRequestException(`Review belum lengkap: ${unresolved} butir belum diputuskan dan ${pendingEvidence} bukti belum diperiksa.`);
        }
        await this.flow.prisma.auditWorkspace.update({
            where: { id },
            data: { status: "AUDIT" },
        });
        await this.notifyAdmins(id, "Review Auditor menunggu keputusan Admin Mutu", `${workspace.unit.name}: review selesai. ${returned} butir dan ${invalidEvidence} bukti memerlukan perhatian saat assessment lapangan.`);
        return {
            ok: true,
            status: "AUDIT",
            returnedItems: returned,
            invalidEvidences: invalidEvidence,
        };
    }
    async approveDeskReview(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.status, ["AUDIT"]);
        const { plan, program } = await this.plan(id);
        const fieldAuditEnd = parseRequiredDate(body.fieldAuditEnd, "Batas akhir assessment lapangan");
        const reportingEnd = parseRequiredDate(body.reportingEnd, "Batas akhir penyusunan laporan");
        const followUpEnd = parseRequiredDate(body.followUpEnd, "Batas akhir CAPA/tindak lanjut");
        const ordered = [fieldAuditEnd, reportingEnd, followUpEnd].map(endOfDay);
        if (ordered[1].getTime() < ordered[0].getTime() ||
            ordered[2].getTime() < ordered[1].getTime()) {
            throw new common_1.BadRequestException("Urutan batas akhir tahapan tidak valid.");
        }
        const start = new Date(program.startDate);
        const end = endOfDay(program.endDate);
        if (ordered.some((deadline) => deadline.getTime() < start.getTime() ||
            deadline.getTime() > end.getTime())) {
            throw new common_1.BadRequestException("Seluruh batas akhir harus berada dalam rentang program audit.");
        }
        const [unresolved, pendingEvidence, returned] = await Promise.all([
            this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: { notIn: ["DESK_ACCEPTED", "RETURNED"] },
                },
            }),
            this.flow.prisma.evidence.count({
                where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
            }),
            this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: "RETURNED",
                },
            }),
        ]);
        if (unresolved || pendingEvidence) {
            throw new common_1.BadRequestException(`Admin belum dapat membuka assessment lapangan: ${unresolved} butir belum diputuskan dan ${pendingEvidence} bukti belum diperiksa.`);
        }
        await this.flow.prisma.$transaction([
            this.flow.prisma.auditUnitPlan.update({
                where: { id: plan.id },
                data: { fieldAuditEnd, reportingEnd, followUpEnd },
            }),
            this.flow.prisma.selfAssessment.updateMany({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: "DESK_ACCEPTED",
                },
                data: {
                    responseStatus: "FIELD_PENDING",
                    standardResult: null,
                    processResult: null,
                    score: null,
                    approvedById: null,
                    approvedAt: null,
                    returnNote: null,
                },
            }),
            this.flow.prisma.selfAssessment.updateMany({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: "RETURNED",
                },
                data: {
                    standardResult: null,
                    processResult: null,
                    score: null,
                    approvedById: null,
                    approvedAt: null,
                },
            }),
            this.flow.prisma.auditWorkspace.update({
                where: { id },
                data: { status: "FIELD_AUDIT" },
            }),
        ]);
        for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
            await this.flow.notifyRole(id, role, "WORKPAPER_SUBMITTED", "Assessment lapangan dibuka", `Admin Mutu membuka assessment lapangan ${workspace.unit.name}. ${returned} butir memerlukan perbaikan Auditee di tahap ini.`, "AuditWorkspace", id);
        }
        if (returned) {
            const auditees = await this.flow.prisma.user.findMany({
                where: {
                    unitId: workspace.unitId,
                    status: "ACTIVE",
                    deletedAt: null,
                    roles: { some: { role: { code: "AUDITEE" } } },
                },
                select: { id: true },
            });
            if (auditees.length) {
                await this.flow.prisma.notification.createMany({
                    data: auditees.map((auditee) => ({
                        workspaceId: id,
                        recipientUserId: auditee.id,
                        event: "SELF_ASSESSMENT_RETURNED",
                        title: "Perbaikan dibuka saat assessment lapangan",
                        message: `${returned} butir dikembalikan Auditor dan sekarang dapat diperbaiki pada tahap assessment lapangan.`,
                        entityType: "AuditWorkspace",
                        entityId: id,
                    })),
                });
            }
        }
        return { ok: true, status: "FIELD_AUDIT", returnedItems: returned };
    }
};
exports.DeskReviewCorrectionController = DeskReviewCorrectionController;
__decorate([
    (0, common_1.Patch)("assessment-evidences/:id/review"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeskReviewCorrectionController.prototype, "reviewEvidence", null);
__decorate([
    (0, common_1.Post)("assessments/:id/auditor-review"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeskReviewCorrectionController.prototype, "reviewAssessment", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/desk-review/submit"),
    (0, auth_1.Roles)("KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeskReviewCorrectionController.prototype, "submitDeskReview", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/desk-review/approve"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeskReviewCorrectionController.prototype, "approveDeskReview", null);
exports.DeskReviewCorrectionController = DeskReviewCorrectionController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], DeskReviewCorrectionController);
//# sourceMappingURL=desk-review-correction.controller.js.map