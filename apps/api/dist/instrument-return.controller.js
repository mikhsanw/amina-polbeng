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
exports.InstrumentReturnController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
let InstrumentReturnController = class InstrumentReturnController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async returnReview(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
        this.flow.requireStatus(workspace.instrumentStatus, ["PENDING_VERIFICATION"]);
        const note = String(body.note ?? "").trim();
        if (!note)
            throw new common_1.BadRequestException("Catatan pengembalian wajib diisi.");
        const [invalidQuestions, pending] = await Promise.all([
            this.flow.prisma.auditQuestion.findMany({
                where: { workspaceId: id, reviewStatus: "RETURNED" },
                select: { id: true, verifierNote: true },
            }),
            this.flow.prisma.auditQuestion.count({
                where: { workspaceId: id, reviewStatus: "PENDING_VERIFICATION" },
            }),
        ]);
        if (pending) {
            throw new common_1.BadRequestException(`Masih ada ${pending} butir yang belum diperiksa Verifikator.`);
        }
        if (!invalidQuestions.length) {
            throw new common_1.BadRequestException("Tidak ada butir tidak valid yang dapat dikembalikan.");
        }
        await this.flow.prisma.$transaction([
            ...invalidQuestions.map((question) => this.flow.prisma.auditQuestion.update({
                where: { id: question.id },
                data: {
                    verifierNote: [question.verifierNote, `Catatan pengembalian: ${note}`]
                        .filter(Boolean)
                        .join("\n\n"),
                },
            })),
            this.flow.prisma.auditWorkspace.update({
                where: { id },
                data: { instrumentStatus: "RETURNED", status: "INSTRUMENT_REVIEW" },
            }),
        ]);
        for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
            await this.flow.notifyRole(id, role, "INSTRUMENT_RETURNED", `${invalidQuestions.length} butir instrumen dikembalikan`, note, "AuditWorkspace", id);
        }
        await this.flow.log(user.id, user.username, "INSTRUMENT_REVIEW_RETURNED", "AuditWorkspace", id, id, {
            note,
            invalid: invalidQuestions.length,
        });
        return { ok: true, status: "RETURNED", invalid: invalidQuestions.length };
    }
};
exports.InstrumentReturnController = InstrumentReturnController;
__decorate([
    (0, common_1.Post)("return-review"),
    (0, auth_1.Roles)("VERIFIKATOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InstrumentReturnController.prototype, "returnReview", null);
exports.InstrumentReturnController = InstrumentReturnController = __decorate([
    (0, common_1.Controller)("audit-flow/workspaces/:id/instrument"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], InstrumentReturnController);
//# sourceMappingURL=instrument-return.controller.js.map