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
exports.AuditSystemQueryController = exports.AuditFollowupController = void 0;
const common_1 = require("@nestjs/common");
const node_path_1 = require("node:path");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
let AuditFollowupController = class AuditFollowupController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async createAction(id, body, user) {
        const finding = await this.flow.prisma.finding.findUniqueOrThrow({
            where: { id },
            include: { workspace: true },
        });
        if (finding.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(finding.status, [
            "OPEN",
            "CAPA_REVIEW",
            "IMPLEMENTATION",
        ]);
        for (const [field, label] of [
            ["correction", "Koreksi langsung"],
            ["rootCauseStatement", "Akar masalah"],
            ["correctiveAction", "Tindakan korektif"],
            ["successIndicator", "Indikator keberhasilan"],
            ["targetDate", "Target penyelesaian"],
        ]) {
            if (!String(body[field] ?? "").trim()) {
                throw new common_1.BadRequestException(`${label} wajib diisi.`);
            }
        }
        const targetDate = new Date(body.targetDate);
        if (Number.isNaN(targetDate.getTime())) {
            throw new common_1.BadRequestException("Target penyelesaian tidak valid.");
        }
        const action = await this.flow.prisma.correctiveAction.create({
            data: {
                correction: body.correction,
                analysisMethod: body.analysisMethod,
                rootCauseStatement: body.rootCauseStatement,
                correctiveAction: body.correctiveAction,
                successIndicator: body.successIndicator,
                picUserId: body.picUserId || null,
                targetDate,
                findingId: id,
                workspaceId: finding.workspaceId,
                status: user.isUnitApprover ? "APPROVED" : "SUBMITTED",
            },
        });
        await this.flow.prisma.finding.update({
            where: { id },
            data: { status: user.isUnitApprover ? "IMPLEMENTATION" : "CAPA_REVIEW" },
        });
        return action;
    }
    async updateAction(id, body, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: true },
        });
        if (action.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(action.status, ["DRAFT", "SUBMITTED", "RETURNED"]);
        const targetDate = body.targetDate
            ? new Date(body.targetDate)
            : action.targetDate;
        if (Number.isNaN(targetDate.getTime())) {
            throw new common_1.BadRequestException("Target penyelesaian tidak valid.");
        }
        const status = user.isUnitApprover ? "APPROVED" : "SUBMITTED";
        const updated = await this.flow.prisma.correctiveAction.update({
            where: { id },
            data: {
                correction: body.correction ?? action.correction,
                analysisMethod: body.analysisMethod ?? action.analysisMethod,
                rootCauseStatement: body.rootCauseStatement ?? action.rootCauseStatement,
                correctiveAction: body.correctiveAction ?? action.correctiveAction,
                successIndicator: body.successIndicator ?? action.successIndicator,
                picUserId: body.picUserId === "" ? null : (body.picUserId ?? action.picUserId),
                targetDate,
                status,
            },
        });
        await this.flow.prisma.finding.update({
            where: { id: action.findingId },
            data: { status: user.isUnitApprover ? "IMPLEMENTATION" : "CAPA_REVIEW" },
        });
        return updated;
    }
    async approveAction(id, user) {
        if (!user.isUnitApprover) {
            throw new common_1.ForbiddenException("Akun Auditee ini bukan pengesah unit.");
        }
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: true },
        });
        if (action.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan pengesah unit target.");
        }
        this.flow.requireStatus(action.status, ["SUBMITTED"]);
        const updated = await this.flow.prisma.correctiveAction.update({
            where: { id },
            data: { status: "APPROVED" },
        });
        await this.flow.prisma.finding.update({
            where: { id: action.findingId },
            data: { status: "IMPLEMENTATION" },
        });
        return updated;
    }
    async returnAction(id, body, user) {
        if (!user.isUnitApprover) {
            throw new common_1.ForbiddenException("Akun Auditee ini bukan pengesah unit.");
        }
        if (!String(body.note ?? "").trim()) {
            throw new common_1.BadRequestException("Catatan pengembalian wajib diisi.");
        }
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: true },
        });
        if (action.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan pengesah unit target.");
        }
        this.flow.requireStatus(action.status, ["SUBMITTED"]);
        const updated = await this.flow.prisma.correctiveAction.update({
            where: { id },
            data: {
                status: "RETURNED",
                progressNote: String(body.note).trim(),
            },
        });
        await this.flow.prisma.finding.update({
            where: { id: action.findingId },
            data: { status: "CAPA_REVIEW" },
        });
        return updated;
    }
    async updateProgress(id, body, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: true },
        });
        if (action.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(action.status, ["APPROVED", "IN_PROGRESS"]);
        const progress = Number(body.progressPercent);
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
            throw new common_1.BadRequestException("Progres harus berada pada rentang 0–100.");
        }
        const updated = await this.flow.prisma.correctiveAction.update({
            where: { id },
            data: {
                progressPercent: progress,
                progressNote: body.progressNote,
                status: progress === 100 ? "READY_VERIFY" : "IN_PROGRESS",
            },
        });
        await this.flow.prisma.finding.update({
            where: { id: action.findingId },
            data: { status: progress === 100 ? "VERIFICATION" : "IMPLEMENTATION" },
        });
        return updated;
    }
    async recommendEffectiveness(id, body, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } } },
        });
        this.flow.requireAssignment(action.workspace, user, [
            "AUDITOR",
            "LEAD_AUDITOR",
        ]);
        this.flow.requireStatus(action.status, ["READY_VERIFY"]);
        if (!String(body.implementationResult ?? "").trim() ||
            !String(body.effectivenessResult ?? "").trim()) {
            throw new common_1.BadRequestException("Hasil pemeriksaan dan rekomendasi efektivitas wajib diisi.");
        }
        if (!["EFFECTIVE", "EFFECTIVE_WITH_MONITORING", "NOT_EFFECTIVE"].includes(body.status)) {
            throw new common_1.BadRequestException("Status rekomendasi efektivitas tidak valid.");
        }
        const existing = await this.flow.prisma.verification.findFirst({
            where: { actionId: id, decidedAt: null },
            orderBy: { verificationDate: "desc" },
        });
        const data = {
            verifierUserId: user.id,
            auditorUserId: user.id,
            implementationResult: body.implementationResult,
            effectivenessResult: body.effectivenessResult,
            status: body.status,
            nextReviewDate: body.nextReviewDate
                ? new Date(body.nextReviewDate)
                : null,
        };
        return existing
            ? this.flow.prisma.verification.update({
                where: { id: existing.id },
                data,
            })
            : this.flow.prisma.verification.create({
                data: { actionId: id, ...data },
            });
    }
    async decideEffectiveness(id, body, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } } },
        });
        this.flow.requireAssignment(action.workspace, user, ["LEAD_AUDITOR"]);
        this.flow.requireStatus(action.status, ["READY_VERIFY"]);
        const recommendation = await this.flow.prisma.verification.findFirst({
            where: { actionId: id, auditorUserId: { not: null } },
            orderBy: { verificationDate: "desc" },
        });
        if (!recommendation && !body.implementationResult) {
            throw new common_1.BadRequestException("Auditor belum memberikan rekomendasi verifikasi tindak lanjut.");
        }
        const status = body.status ?? recommendation?.status;
        if (!status)
            throw new common_1.BadRequestException("Keputusan efektivitas wajib dipilih.");
        if (!["EFFECTIVE", "EFFECTIVE_WITH_MONITORING", "NOT_EFFECTIVE"].includes(status)) {
            throw new common_1.BadRequestException("Keputusan efektivitas tidak valid.");
        }
        const effective = status !== "NOT_EFFECTIVE";
        const verification = recommendation
            ? await this.flow.prisma.verification.update({
                where: { id: recommendation.id },
                data: {
                    leadAuditorUserId: user.id,
                    implementationResult: body.implementationResult ?? recommendation.implementationResult,
                    effectivenessResult: body.effectivenessResult ?? recommendation.effectivenessResult,
                    status,
                    nextReviewDate: body.nextReviewDate
                        ? new Date(body.nextReviewDate)
                        : recommendation.nextReviewDate,
                    decidedAt: new Date(),
                    closedAt: status === "EFFECTIVE" ? new Date() : null,
                },
            })
            : await this.flow.prisma.verification.create({
                data: {
                    actionId: id,
                    verifierUserId: user.id,
                    leadAuditorUserId: user.id,
                    implementationResult: body.implementationResult,
                    effectivenessResult: body.effectivenessResult,
                    status,
                    nextReviewDate: body.nextReviewDate
                        ? new Date(body.nextReviewDate)
                        : null,
                    decidedAt: new Date(),
                    closedAt: status === "EFFECTIVE" ? new Date() : null,
                },
            });
        await this.flow.prisma.correctiveAction.update({
            where: { id },
            data: { status: effective ? "EFFECTIVE" : "NOT_EFFECTIVE" },
        });
        await this.flow.prisma.finding.update({
            where: { id: action.findingId },
            data: { status: effective ? "CLOSED" : "IMPLEMENTATION" },
        });
        return verification;
    }
    async deleteAction(id, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { verifications: true, workspace: true },
        });
        if (action.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(action.status, [
            "DRAFT",
            "SUBMITTED",
            "RETURNED",
            "IN_PROGRESS",
        ]);
        if (action.verifications.length) {
            throw new common_1.BadRequestException("Tindak lanjut telah diverifikasi.");
        }
        await this.flow.prisma.correctiveAction.delete({ where: { id } });
        return { ok: true };
    }
    async closeWorkspace(id, user) {
        await this.flow.workspace(id, user);
        const openFindings = await this.flow.prisma.finding.count({
            where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
        });
        if (openFindings) {
            throw new common_1.BadRequestException(`${openFindings} temuan belum ditutup.`);
        }
        return this.flow.prisma.auditWorkspace.update({
            where: { id },
            data: { status: "CLOSED" },
        });
    }
    async registerPrint(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        const type = body.type || "AUDIT_REPORT";
        const version = (await this.flow.prisma.printDocument.count({
            where: { workspaceId: id, type },
        })) + 1;
        const fileName = `${type}_${workspace.unit.slug}_${workspace.auditYear}_v${version}.pdf`;
        return this.flow.prisma.printDocument.create({
            data: {
                workspaceId: id,
                type,
                fileName,
                version,
                storageKey: (0, node_path_1.join)("storage", "audits", String(workspace.auditYear), workspace.name, "print", fileName),
                status: "DRAFT",
            },
        });
    }
    notifications(user) {
        return this.flow.prisma.notification.findMany({
            where: { recipientUserId: user.id },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    }
    logs() {
        return this.flow.prisma.activityLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 250,
        });
    }
};
exports.AuditFollowupController = AuditFollowupController;
__decorate([
    (0, common_1.Post)("findings/:id/corrective-actions"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "createAction", null);
__decorate([
    (0, common_1.Patch)("actions/:id"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "updateAction", null);
__decorate([
    (0, common_1.Post)("actions/:id/approve"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "approveAction", null);
__decorate([
    (0, common_1.Post)("actions/:id/return"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "returnAction", null);
__decorate([
    (0, common_1.Post)("actions/:id/progress"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "updateProgress", null);
__decorate([
    (0, common_1.Post)("actions/:id/recommendation"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "recommendEffectiveness", null);
__decorate([
    (0, common_1.Post)("actions/:id/verify"),
    (0, auth_1.Roles)("KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "decideEffectiveness", null);
__decorate([
    (0, common_1.Delete)("actions/:id"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "deleteAction", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/close"),
    (0, auth_1.Roles)("ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "closeWorkspace", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/print"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditFollowupController.prototype, "registerPrint", null);
__decorate([
    (0, common_1.Get)("notifications"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditFollowupController.prototype, "notifications", null);
__decorate([
    (0, common_1.Get)("activity-logs"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditFollowupController.prototype, "logs", null);
exports.AuditFollowupController = AuditFollowupController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], AuditFollowupController);
let AuditSystemQueryController = class AuditSystemQueryController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    notifications(user) {
        return this.flow.prisma.notification.findMany({
            where: { recipientUserId: user.id },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    }
    logs() {
        return this.flow.prisma.activityLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 250,
        });
    }
};
exports.AuditSystemQueryController = AuditSystemQueryController;
__decorate([
    (0, common_1.Get)("notifications"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditSystemQueryController.prototype, "notifications", null);
__decorate([
    (0, common_1.Get)("activity-logs"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditSystemQueryController.prototype, "logs", null);
exports.AuditSystemQueryController = AuditSystemQueryController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], AuditSystemQueryController);
//# sourceMappingURL=audit-followup.controller.js.map