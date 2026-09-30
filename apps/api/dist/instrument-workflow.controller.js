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
exports.InstrumentWorkflowController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
let InstrumentWorkflowController = class InstrumentWorkflowController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async editQuestion(id, body, user) {
        const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } } },
        });
        this.flow.requireAssignment(question.workspace, user, [
            "AUDITOR",
            "LEAD_AUDITOR",
        ]);
        this.flow.requireStatus(question.reviewStatus, [
            "AUDITOR_REVIEW",
            "RETURNED",
            "DRAFT",
        ]);
        const proposed = {
            question: String(body.auditorQuestion ??
                body.questionSnapshot ??
                question.defaultQuestion).trim(),
            expectedEvidence: body.auditorExpectedEvidence ??
                body.expectedEvidence ??
                question.defaultExpectedEvidence,
            testMethod: body.auditorTestMethod ?? body.testMethod ?? question.defaultTestMethod,
            riskLevel: body.auditorRiskLevel ?? body.riskLevel ?? question.defaultRiskLevel,
        };
        const defaults = this.flow.questionDefault(question);
        const changeFields = Object.keys(proposed).filter((key) => String(proposed[key] ?? "").trim() !==
            String(defaults[key] ?? "").trim());
        const changeFlag = changeFields.length > 0 || question.excluded;
        if (changeFlag &&
            !String(body.changeReason ?? question.changeReason ?? "").trim()) {
            throw new common_1.BadRequestException("Alasan perubahan instrumen wajib diisi.");
        }
        const updated = await this.flow.prisma.auditQuestion.update({
            where: { id },
            data: {
                auditorQuestion: proposed.question,
                auditorExpectedEvidence: proposed.expectedEvidence,
                auditorTestMethod: proposed.testMethod,
                auditorRiskLevel: proposed.riskLevel,
                questionSnapshot: proposed.question,
                changeFlag,
                changeFields,
                changeReason: body.changeReason ?? question.changeReason,
                auditorNote: body.auditorNote,
                reviewedById: user.id,
                reviewedAt: new Date(),
                reviewStatus: "AUDITOR_REVIEW",
            },
        });
        await this.flow.prisma.auditWorkspace.update({
            where: { id: question.workspaceId },
            data: {
                instrumentChangeCount: await this.flow.prisma.auditQuestion.count({
                    where: { workspaceId: question.workspaceId, changeFlag: true },
                }),
            },
        });
        return updated;
    }
    async excludeQuestion(id, body, user) {
        const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } } },
        });
        this.flow.requireAssignment(question.workspace, user, [
            "AUDITOR",
            "LEAD_AUDITOR",
        ]);
        this.flow.requireStatus(question.reviewStatus, [
            "AUDITOR_REVIEW",
            "RETURNED",
            "DRAFT",
        ]);
        if (!body?.reason) {
            throw new common_1.BadRequestException("Alasan pengecualian pertanyaan wajib diisi.");
        }
        const updated = await this.flow.prisma.auditQuestion.update({
            where: { id },
            data: {
                excluded: true,
                exclusionReason: body.reason,
                changeFlag: true,
                changeFields: ["excluded"],
                changeReason: body.reason,
                reviewedById: user.id,
                reviewedAt: new Date(),
            },
        });
        await this.flow.prisma.auditWorkspace.update({
            where: { id: question.workspaceId },
            data: {
                instrumentChangeCount: await this.flow.prisma.auditQuestion.count({
                    where: { workspaceId: question.workspaceId, changeFlag: true },
                }),
            },
        });
        return updated;
    }
    async includeQuestion(id, user) {
        const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } } },
        });
        this.flow.requireAssignment(question.workspace, user, [
            "AUDITOR",
            "LEAD_AUDITOR",
        ]);
        this.flow.requireStatus(question.reviewStatus, [
            "AUDITOR_REVIEW",
            "RETURNED",
            "DRAFT",
        ]);
        const proposed = {
            question: question.auditorQuestion ?? question.defaultQuestion,
            expectedEvidence: question.auditorExpectedEvidence ?? question.defaultExpectedEvidence,
            testMethod: question.auditorTestMethod ?? question.defaultTestMethod,
            riskLevel: question.auditorRiskLevel ?? question.defaultRiskLevel,
        };
        const defaults = this.flow.questionDefault(question);
        const changeFields = Object.keys(proposed).filter((key) => String(proposed[key] ?? "").trim() !==
            String(defaults[key] ?? "").trim());
        const updated = await this.flow.prisma.auditQuestion.update({
            where: { id },
            data: {
                excluded: false,
                exclusionReason: null,
                changeFlag: changeFields.length > 0,
                changeFields,
                changeReason: changeFields.length ? question.changeReason : null,
                reviewedById: user.id,
                reviewedAt: new Date(),
            },
        });
        await this.flow.prisma.auditWorkspace.update({
            where: { id: question.workspaceId },
            data: {
                instrumentChangeCount: await this.flow.prisma.auditQuestion.count({
                    where: { workspaceId: question.workspaceId, changeFlag: true },
                }),
            },
        });
        return updated;
    }
    async submit(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.instrumentStatus, [
            "AUDITOR_REVIEW",
            "RETURNED",
            "DRAFT",
        ]);
        const total = await this.flow.prisma.auditQuestion.count({
            where: { workspaceId: id },
        });
        if (!total)
            throw new common_1.BadRequestException("Instrumen belum dibentuk.");
        const changeCount = await this.flow.prisma.auditQuestion.count({
            where: { workspaceId: id, changeFlag: true },
        });
        if (changeCount === 0) {
            if (!workspace.team.some((member) => member.userId === user.id && member.role === "LEAD_AUDITOR")) {
                throw new common_1.ForbiddenException("Instrumen tanpa perubahan hanya dapat dipublikasikan oleh Ketua Auditor.");
            }
            return this.flow.publishInstrument(id, user, body.note ?? "Tidak ada perubahan instrumen.");
        }
        if (!workspace.team.some((member) => member.userId === user.id && member.role === "LEAD_AUDITOR")) {
            throw new common_1.ForbiddenException("Usulan perubahan harus diajukan oleh Ketua Auditor.");
        }
        await this.flow.prisma.$transaction([
            this.flow.prisma.auditQuestion.updateMany({
                where: { workspaceId: id, changeFlag: true },
                data: { reviewStatus: "PENDING_VERIFICATION" },
            }),
            this.flow.prisma.auditWorkspace.update({
                where: { id },
                data: {
                    instrumentStatus: "PENDING_VERIFICATION",
                    status: "INSTRUMENT_APPROVAL",
                    instrumentChangeCount: changeCount,
                },
            }),
        ]);
        await this.flow.notifyRole(id, "VERIFIER", "INSTRUMENT_APPROVAL_REQUESTED", "Perubahan instrumen menunggu verifikasi", `${changeCount} butir instrumen diusulkan berubah oleh tim auditor.`, "AuditWorkspace", id);
        return { ok: true, changeCount };
    }
    async returnChanges(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
        this.flow.requireStatus(workspace.instrumentStatus, [
            "PENDING_VERIFICATION",
        ]);
        if (!body.note)
            throw new common_1.BadRequestException("Catatan pengembalian wajib diisi.");
        const changed = await this.flow.prisma.auditQuestion.findMany({
            where: { workspaceId: id, changeFlag: true },
        });
        await this.flow.prisma.$transaction([
            ...changed.map((question) => this.flow.prisma.instrumentChangeReview.create({
                data: {
                    workspaceId: id,
                    auditQuestionId: question.id,
                    verifierUserId: user.id,
                    decision: "RETURN",
                    note: body.note,
                    beforeValue: this.flow.questionDefault(question),
                    proposedValue: this.flow.questionProposal(question),
                },
            })),
            this.flow.prisma.auditQuestion.updateMany({
                where: { workspaceId: id, changeFlag: true },
                data: { reviewStatus: "RETURNED", verifierNote: body.note },
            }),
            this.flow.prisma.auditWorkspace.update({
                where: { id },
                data: { instrumentStatus: "RETURNED", status: "INSTRUMENT_REVIEW" },
            }),
        ]);
        await this.flow.notifyRole(id, "LEAD_AUDITOR", "INSTRUMENT_RETURNED", "Perubahan instrumen dikembalikan", body.note, "AuditWorkspace", id);
        return { ok: true };
    }
    async rejectChanges(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
        this.flow.requireStatus(workspace.instrumentStatus, [
            "PENDING_VERIFICATION",
        ]);
        if (!body.note)
            throw new common_1.BadRequestException("Alasan penolakan wajib diisi.");
        const changed = await this.flow.prisma.auditQuestion.findMany({
            where: { workspaceId: id, changeFlag: true },
        });
        await this.flow.prisma.$transaction([
            ...changed.map((question) => this.flow.prisma.instrumentChangeReview.create({
                data: {
                    workspaceId: id,
                    auditQuestionId: question.id,
                    verifierUserId: user.id,
                    decision: "REJECT",
                    note: body.note,
                    beforeValue: this.flow.questionDefault(question),
                    proposedValue: this.flow.questionProposal(question),
                },
            })),
            ...changed.map((question) => this.flow.prisma.auditQuestion.update({
                where: { id: question.id },
                data: {
                    auditorQuestion: null,
                    auditorExpectedEvidence: null,
                    auditorTestMethod: null,
                    auditorRiskLevel: null,
                    questionSnapshot: question.defaultQuestion,
                    excluded: false,
                    exclusionReason: null,
                    changeFlag: false,
                    changeFields: [],
                    reviewStatus: "APPROVED",
                    verifierNote: body.note,
                },
            })),
            this.flow.prisma.auditWorkspace.update({
                where: { id },
                data: { instrumentChangeCount: 0 },
            }),
        ]);
        return this.flow.publishInstrument(id, user, `Usulan perubahan ditolak: ${body.note}`);
    }
    async approveChanges(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
        this.flow.requireStatus(workspace.instrumentStatus, [
            "PENDING_VERIFICATION",
        ]);
        const changed = await this.flow.prisma.auditQuestion.findMany({
            where: { workspaceId: id, changeFlag: true },
        });
        if (!changed.length)
            throw new common_1.BadRequestException("Tidak ada perubahan untuk diverifikasi.");
        await this.flow.prisma.$transaction(changed.map((question) => this.flow.prisma.instrumentChangeReview.create({
            data: {
                workspaceId: id,
                auditQuestionId: question.id,
                verifierUserId: user.id,
                decision: "APPROVE",
                note: body.note,
                beforeValue: this.flow.questionDefault(question),
                proposedValue: this.flow.questionProposal(question),
            },
        })));
        return this.flow.publishInstrument(id, user, body.note ?? "Perubahan instrumen disetujui.");
    }
};
exports.InstrumentWorkflowController = InstrumentWorkflowController;
__decorate([
    (0, common_1.Patch)("questions/:id"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "editQuestion", null);
__decorate([
    (0, common_1.Delete)("questions/:id"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "excludeQuestion", null);
__decorate([
    (0, common_1.Post)("questions/:id/include"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "includeQuestion", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/instrument/submit"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/instrument/return"),
    (0, auth_1.Roles)("VERIFIKATOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "returnChanges", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/instrument/reject"),
    (0, auth_1.Roles)("VERIFIKATOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "rejectChanges", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/instrument/approve"),
    (0, auth_1.Roles)("VERIFIKATOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentWorkflowController.prototype, "approveChanges", null);
exports.InstrumentWorkflowController = InstrumentWorkflowController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], InstrumentWorkflowController);
//# sourceMappingURL=instrument-workflow.controller.js.map