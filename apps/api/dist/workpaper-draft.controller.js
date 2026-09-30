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
exports.WorkpaperDraftController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const PROCESS_RESULTS = new Set([
    "C",
    "OBS",
    "KTS_MINOR",
    "KTS_MAYOR",
    "NA",
]);
const STANDARD_RESULTS = new Set([
    "MELAMPAUI",
    "TERCAPAI",
    "TIDAK_TERCAPAI",
    "BELUM_DIUKUR",
]);
let WorkpaperDraftController = class WorkpaperDraftController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async saveDraft(workspaceId, body, user) {
        const auditQuestionId = String(body.auditQuestionId || "").trim();
        if (!auditQuestionId) {
            throw new common_1.BadRequestException("Pertanyaan audit wajib dipilih.");
        }
        const workspace = await this.flow.workspace(workspaceId, user);
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        const question = await this.flow.prisma.auditQuestion.findUnique({
            where: { id: auditQuestionId },
            include: {
                assessment: true,
                masterQuestion: { include: { isoClause: true } },
            },
        });
        if (!question || question.workspaceId !== workspaceId) {
            throw new common_1.BadRequestException("Pertanyaan tidak berasal dari ruang kerja ini.");
        }
        if (question.reviewStatus !== "PUBLISHED" || question.excluded) {
            throw new common_1.BadRequestException("Pertanyaan belum tersedia pada instrumen yang dipublikasikan.");
        }
        const isIso = Boolean(question.masterQuestion.isoClauseId || question.masterQuestion.isoClause) ||
            question.masterQuestion.criterionSource === "ISO_9001";
        let standardResult = null;
        let processResult = null;
        if (isIso) {
            processResult = String(body.processResult || question.assessment?.processResult || "")
                .trim()
                .toUpperCase()
                .replace("NC_MINOR", "KTS_MINOR")
                .replace("NC_MAJOR", "KTS_MAYOR");
            if (!PROCESS_RESULTS.has(processResult)) {
                throw new common_1.BadRequestException("Kategori ISO harus C, OBS, KTS/NC Minor, KTS/NC Mayor, atau NA.");
            }
        }
        else {
            standardResult = String(body.standardResult || question.assessment?.standardResult || "")
                .trim()
                .toUpperCase()
                .replace("BELUM_DIKERJAKAN", "BELUM_DIUKUR");
            if (!STANDARD_RESULTS.has(standardResult)) {
                throw new common_1.BadRequestException("Kategori SPMI harus Melampaui, Tercapai, Tidak Tercapai, atau Belum Diukur.");
            }
        }
        const objectiveEvidence = String(body.objectiveEvidence || "").trim();
        const auditorAnalysis = String(body.auditorAnalysis || "").trim();
        if (!objectiveEvidence || !auditorAnalysis) {
            throw new common_1.BadRequestException("Bukti objektif dan analisis Auditor wajib diisi sebelum menyimpan draft.");
        }
        const existing = await this.flow.prisma.workpaper.findUnique({
            where: {
                auditQuestionId_auditorUserId: {
                    auditQuestionId,
                    auditorUserId: user.id,
                },
            },
        });
        if (existing) {
            this.flow.requireStatus(existing.documentStatus, ["DRAFT", "RETURNED"]);
        }
        const auditStatus = isIso
            ? processResult
            : standardResult === "BELUM_DIUKUR"
                ? "OBS"
                : standardResult === "TIDAK_TERCAPAI"
                    ? "KTS_MINOR"
                    : "C";
        const data = {
            sampleDescription: String(body.sampleDescription || "").trim() || null,
            interviewee: String(body.interviewee || "").trim() || null,
            objectiveEvidence,
            auditorAnalysis,
            auditStatus,
            documentStatus: "DRAFT",
            standardResult,
            processResult,
        };
        const saved = await this.flow.prisma.workpaper.upsert({
            where: {
                auditQuestionId_auditorUserId: {
                    auditQuestionId,
                    auditorUserId: user.id,
                },
            },
            create: {
                auditQuestionId,
                auditorUserId: user.id,
                ...data,
            },
            update: data,
        });
        await this.flow.log(user.id, user.username, "WORKPAPER_DRAFT_SAVED", "Workpaper", saved.id, workspaceId, {
            auditQuestionId,
            sourceType: isIso ? "ISO" : "SPMI",
            standardResult,
            processResult,
        });
        return saved;
    }
};
exports.WorkpaperDraftController = WorkpaperDraftController;
__decorate([
    (0, common_1.Post)("workspaces/:id/workpapers"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkpaperDraftController.prototype, "saveDraft", null);
exports.WorkpaperDraftController = WorkpaperDraftController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], WorkpaperDraftController);
//# sourceMappingURL=workpaper-draft.controller.js.map