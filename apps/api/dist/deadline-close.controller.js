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
exports.DeadlineCloseController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_archive_controller_1 = require("./audit-archive.controller");
let DeadlineCloseController = class DeadlineCloseController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async close(id, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.status, ["REPORT_REVIEW"]);
        const [openFindings, archiveDocuments] = await Promise.all([
            this.flow.prisma.finding.count({
                where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
            }),
            this.flow.prisma.evidence.findMany({
                where: {
                    workspaceId: id,
                    auditQuestionId: null,
                    description: audit_archive_controller_1.SIGNED_ARCHIVE_MARKER,
                    deletedAt: null,
                },
                select: { id: true, reviewStatus: true },
            }),
        ]);
        if (openFindings) {
            throw new common_1.BadRequestException(`${openFindings} temuan belum ditutup.`);
        }
        if (!archiveDocuments.length) {
            throw new common_1.BadRequestException("Laporan bertanda tangan belum diunggah pada menu Archive.");
        }
        const notValid = archiveDocuments.filter((document) => document.reviewStatus !== "VALID").length;
        if (notValid) {
            throw new common_1.BadRequestException(`${notValid} dokumen Archive belum dinyatakan Valid oleh Admin Mutu.`);
        }
        const closed = await this.flow.prisma.auditWorkspace.update({
            where: { id },
            data: { status: "CLOSED" },
        });
        await this.flow.log(user.id, user.username, "AUDIT_CLOSED", "AuditWorkspace", id, id, { status: "CLOSED", archiveDocumentCount: archiveDocuments.length });
        return closed;
    }
};
exports.DeadlineCloseController = DeadlineCloseController;
__decorate([
    (0, common_1.Post)("workspaces/:id/close"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeadlineCloseController.prototype, "close", null);
exports.DeadlineCloseController = DeadlineCloseController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], DeadlineCloseController);
//# sourceMappingURL=deadline-close.controller.js.map