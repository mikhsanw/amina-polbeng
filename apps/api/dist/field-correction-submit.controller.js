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
exports.FieldCorrectionSubmitController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
let FieldCorrectionSubmitController = class FieldCorrectionSubmitController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    async submit(id, user) {
        const workspace = await this.flow.workspace(id, user);
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
        await this.schedule.requireOpen(id, "FIELD_AUDIT");
        const corrections = await this.flow.prisma.selfAssessment.findMany({
            where: {
                question: { workspaceId: id, excluded: false },
                responseStatus: "IN_PROGRESS",
            },
            select: {
                id: true,
                auditQuestionId: true,
                implementationDescription: true,
                evidenceSummary: true,
                constraintNote: true,
                returnNote: true,
            },
        });
        if (!corrections.length) {
            throw new common_1.BadRequestException("Belum ada perbaikan lapangan yang disimpan untuk dikirim kepada Auditor.");
        }
        const incomplete = corrections.filter((item) => !String(item.implementationDescription || "").trim());
        if (incomplete.length) {
            throw new common_1.BadRequestException(`${incomplete.length} butir perbaikan belum memiliki uraian kondisi/pelaksanaan.`);
        }
        const now = new Date();
        await this.flow.prisma.selfAssessment.updateMany({
            where: { id: { in: corrections.map((item) => item.id) } },
            data: {
                responseStatus: "FIELD_CORRECTION_SUBMITTED",
                submittedById: user.id,
                submittedAt: now,
                approvedById: null,
                approvedAt: null,
            },
        });
        for (const correction of corrections) {
            await this.flow.log(user.id, user.username, "FIELD_CORRECTION_SUBMITTED", "SelfAssessment", correction.id, id, {
                auditQuestionId: correction.auditQuestionId,
                implementationDescription: correction.implementationDescription,
                evidenceSummary: correction.evidenceSummary,
                constraintNote: correction.constraintNote,
                submittedAt: now.toISOString(),
            }, {
                returnNote: correction.returnNote,
                responseStatus: "IN_PROGRESS",
            });
        }
        const message = `${workspace.unit.name}: ${corrections.length} perbaikan lapangan telah dikirim dan siap diperiksa.`;
        for (const role of ["AUDITOR", "LEAD_AUDITOR"]) {
            await this.flow.notifyRole(id, role, "SELF_ASSESSMENT_SUBMITTED", "Perbaikan lapangan siap diperiksa", message, "AuditWorkspace", id);
        }
        return {
            ok: true,
            count: corrections.length,
            status: "FIELD_CORRECTION_SUBMITTED",
        };
    }
};
exports.FieldCorrectionSubmitController = FieldCorrectionSubmitController;
__decorate([
    (0, common_1.Post)("workspaces/:id/field-corrections/submit"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FieldCorrectionSubmitController.prototype, "submit", null);
exports.FieldCorrectionSubmitController = FieldCorrectionSubmitController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], FieldCorrectionSubmitController);
//# sourceMappingURL=field-correction-submit.controller.js.map