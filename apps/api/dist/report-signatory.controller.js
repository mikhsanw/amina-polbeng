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
exports.ReportSignatoryController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
let ReportSignatoryController = class ReportSignatoryController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async signatories(id, user) {
        const workspace = await this.flow.workspace(id, user);
        const auditee = await this.flow.prisma.user.findFirst({
            where: {
                unitId: workspace.unitId,
                status: "ACTIVE",
                deletedAt: null,
                isUnitApprover: true,
                roles: { some: { role: { code: "AUDITEE" } } },
            },
            select: { id: true, fullName: true },
        });
        const lead = workspace.team.find((member) => member.role === "LEAD_AUDITOR");
        const auditors = workspace.team
            .filter((member) => member.role === "AUDITOR")
            .map((member) => ({ id: member.user.id, fullName: member.user.fullName }));
        return {
            auditee,
            leadAuditor: lead
                ? { id: lead.user.id, fullName: lead.user.fullName }
                : null,
            auditors,
        };
    }
};
exports.ReportSignatoryController = ReportSignatoryController;
__decorate([
    (0, common_1.Get)("workspaces/:id/report-signatories"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReportSignatoryController.prototype, "signatories", null);
exports.ReportSignatoryController = ReportSignatoryController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], ReportSignatoryController);
//# sourceMappingURL=report-signatory.controller.js.map