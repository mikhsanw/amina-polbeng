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
exports.AssessmentFlowReadController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
let AssessmentFlowReadController = class AssessmentFlowReadController {
    flow;
    scheduleService;
    constructor(flow, scheduleService) {
        this.flow = flow;
        this.scheduleService = scheduleService;
    }
    async detail(id, user) {
        let workspace = await this.flow.workspace(id, user);
        if (workspace.status === "SELF_ASSESSMENT") {
            const legacyReturned = await this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: "RETURNED",
                },
            });
            if (legacyReturned) {
                await this.flow.prisma.auditWorkspace.update({
                    where: { id },
                    data: { status: "DESK_REVIEW" },
                });
                workspace = await this.flow.workspace(id, user);
            }
        }
        const published = await this.flow.prisma.auditQuestion.findMany({
            where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
            select: { id: true },
        });
        if (published.length) {
            await this.flow.prisma.selfAssessment.createMany({
                data: published.map((question) => ({
                    auditQuestionId: question.id,
                    responseStatus: workspace.status === "FIELD_AUDIT" ? "FIELD_PENDING" : "NOT_STARTED",
                })),
                skipDuplicates: true,
            });
        }
        if (workspace.status === "FIELD_AUDIT") {
            const legacyAccepted = await this.flow.prisma.selfAssessment.findMany({
                where: {
                    question: {
                        workspaceId: id,
                        excluded: false,
                        workpapers: { none: {} },
                    },
                    responseStatus: { in: ["APPROVED", "DESK_ACCEPTED"] },
                    standardResult: null,
                    processResult: null,
                },
                select: { id: true },
            });
            if (legacyAccepted.length) {
                await this.flow.prisma.selfAssessment.updateMany({
                    where: { id: { in: legacyAccepted.map((item) => item.id) } },
                    data: {
                        responseStatus: "FIELD_PENDING",
                        approvedById: null,
                        approvedAt: null,
                    },
                });
            }
        }
        const [questions, evidences, schedule] = await Promise.all([
            this.flow.prisma.auditQuestion.findMany({
                where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
                include: {
                    assessment: true,
                    masterQuestion: { include: { standard: true, isoClause: true } },
                    evidences: {
                        where: { deletedAt: null },
                        include: { uploadedBy: { select: { id: true, fullName: true } } },
                        orderBy: { uploadedAt: "desc" },
                    },
                    findings: { orderBy: { createdAt: "desc" } },
                    workpapers: {
                        include: { auditor: { select: { id: true, fullName: true } } },
                        orderBy: { updatedAt: "desc" },
                    },
                },
                orderBy: { sortOrder: "asc" },
            }),
            this.flow.prisma.evidence.findMany({
                where: { workspaceId: id, deletedAt: null },
                include: {
                    auditQuestion: { select: { id: true, sortOrder: true } },
                    uploadedBy: { select: { id: true, fullName: true } },
                },
                orderBy: { uploadedAt: "desc" },
            }),
            this.scheduleService.detail(id),
        ]);
        return { workspace, questions, evidences, schedule };
    }
};
exports.AssessmentFlowReadController = AssessmentFlowReadController;
__decorate([
    (0, common_1.Get)("workspaces/:id/assessment-flow"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AssessmentFlowReadController.prototype, "detail", null);
exports.AssessmentFlowReadController = AssessmentFlowReadController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], AssessmentFlowReadController);
//# sourceMappingURL=assessment-flow-read.controller.js.map