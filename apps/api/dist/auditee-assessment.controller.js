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
exports.AuditeeAssessmentController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
let AuditeeAssessmentController = class AuditeeAssessmentController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    async detail(id, user) {
        const workspace = await this.flow.workspace(id, user);
        const published = await this.flow.prisma.auditQuestion.findMany({
            where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
            select: { id: true },
        });
        if (published.length) {
            await this.flow.prisma.selfAssessment.createMany({
                data: published.map((question) => ({
                    auditQuestionId: question.id,
                    responseStatus: "NOT_STARTED",
                })),
                skipDuplicates: true,
            });
        }
        const [questions, evidences, schedule] = await Promise.all([
            this.flow.prisma.auditQuestion.findMany({
                where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
                include: {
                    assessment: true,
                    masterQuestion: { include: { standard: true, isoClause: true } },
                    evidences: {
                        where: { deletedAt: null },
                        orderBy: { uploadedAt: "desc" },
                    },
                    findings: { orderBy: { createdAt: "desc" } },
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
            this.schedule.detail(id),
        ]);
        return { workspace, questions, evidences, schedule };
    }
    async saveAnswer(id, body, user) {
        const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
            where: { id },
            include: { question: { include: { workspace: true } } },
        });
        const workspace = assessment.question.workspace;
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        if (workspace.status === "SELF_ASSESSMENT") {
            await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT");
            this.flow.requireStatus(assessment.responseStatus, [
                "NOT_STARTED",
                "IN_PROGRESS",
                "RETURNED",
            ]);
        }
        else if (workspace.status === "FIELD_AUDIT") {
            await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");
            this.flow.requireStatus(assessment.responseStatus, [
                "RETURNED",
                "OPEN",
                "IN_PROGRESS",
            ]);
        }
        else {
            throw new common_1.BadRequestException("Jawaban tidak dapat diubah pada tahap audit saat ini.");
        }
        const implementationDescription = String(body.implementationDescription ?? "").trim();
        const updated = await this.flow.prisma.selfAssessment.update({
            where: { id },
            data: {
                response: implementationDescription || null,
                implementationDescription: implementationDescription || null,
                evidenceSummary: String(body.evidenceSummary ?? "").trim() || null,
                constraintNote: String(body.constraintNote ?? "").trim() || null,
                responseStatus: "IN_PROGRESS",
                score: null,
                standardResult: null,
                processResult: null,
            },
        });
        await this.flow.log(user.id, user.username, "SELF_ASSESSMENT_ANSWER_SAVED", "SelfAssessment", id, workspace.id, { auditQuestionId: assessment.auditQuestionId });
        return updated;
    }
    async upload(id, file, body, user) {
        if (!file)
            throw new common_1.BadRequestException("File bukti wajib dipilih.");
        const workspace = await this.flow.workspace(id, user);
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        const auditQuestionId = String(body.auditQuestionId ?? "").trim();
        if (!auditQuestionId) {
            throw new common_1.BadRequestException("Pertanyaan audit untuk bukti wajib dipilih.");
        }
        const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
            where: { id: auditQuestionId },
            include: { assessment: true },
        });
        if (question.workspaceId !== id || question.excluded) {
            throw new common_1.BadRequestException("Pertanyaan bukti tidak berasal dari workspace ini.");
        }
        if (workspace.status === "SELF_ASSESSMENT") {
            await this.schedule.requireOpen(id, "SELF_ASSESSMENT");
        }
        else if (workspace.status === "FIELD_AUDIT") {
            await this.schedule.requireOpen(id, "FIELD_AUDIT");
            if (!["RETURNED", "OPEN", "IN_PROGRESS"].includes(question.assessment?.responseStatus || "")) {
                throw new common_1.BadRequestException("Bukti perbaikan hanya dapat diunggah untuk butir yang dikembalikan atau Open.");
            }
        }
        else {
            throw new common_1.BadRequestException("Unggah bukti tidak tersedia pada tahap audit saat ini.");
        }
        const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
        if (!file.buffer?.length || file.buffer.length > maxBytes) {
            throw new common_1.BadRequestException(`Ukuran file maksimal ${process.env.MAX_UPLOAD_MB ?? 20} MB.`);
        }
        const directory = (0, node_path_1.join)(process.cwd(), "storage", "audits", String(workspace.auditYear), workspace.name, "evidence");
        await (0, promises_1.mkdir)(directory, { recursive: true });
        const safeName = `${Date.now()}-${String(file.originalname).replace(/[^\w.-]/g, "_")}`;
        await (0, promises_1.writeFile)((0, node_path_1.join)(directory, safeName), file.buffer);
        const count = await this.flow.prisma.evidence.count();
        const evidence = await this.flow.prisma.evidence.create({
            data: {
                code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
                workspaceId: id,
                auditQuestionId,
                evidenceType: body.evidenceType || "OTHER",
                title: body.title || file.originalname,
                description: body.description || null,
                fileName: file.originalname,
                mimeType: file.mimetype || "application/octet-stream",
                fileSizeBytes: file.buffer.length,
                storageKey: (0, node_path_1.join)("storage", "audits", String(workspace.auditYear), workspace.name, "evidence", safeName),
                checksum: (0, node_crypto_1.createHash)("sha256").update(file.buffer).digest("hex"),
                uploadedById: user.id,
                confidentiality: body.confidentiality || "INTERNAL",
            },
        });
        await this.flow.log(user.id, user.username, "ASSESSMENT_EVIDENCE_UPLOADED", "Evidence", evidence.id, id, { auditQuestionId, fileName: file.originalname });
        return evidence;
    }
};
exports.AuditeeAssessmentController = AuditeeAssessmentController;
__decorate([
    (0, common_1.Get)("workspaces/:id/assessment-flow"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditeeAssessmentController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)("assessments/:id/auditee"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditeeAssessmentController.prototype, "saveAnswer", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/assessment-evidences/upload"),
    (0, auth_1.Roles)("AUDITEE"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditeeAssessmentController.prototype, "upload", null);
exports.AuditeeAssessmentController = AuditeeAssessmentController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], AuditeeAssessmentController);
//# sourceMappingURL=auditee-assessment.controller.js.map