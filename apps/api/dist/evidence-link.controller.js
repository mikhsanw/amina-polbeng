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
exports.EvidenceLinkController = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
function googleDriveUrl(value) {
    let url;
    try {
        url = new URL(String(value ?? "").trim());
    }
    catch {
        throw new common_1.BadRequestException("Link Google Drive tidak valid.");
    }
    if (url.protocol !== "https:") {
        throw new common_1.BadRequestException("Link bukti harus menggunakan HTTPS.");
    }
    const host = url.hostname.toLowerCase();
    if (host !== "drive.google.com" && host !== "docs.google.com") {
        throw new common_1.BadRequestException("Link bukti hanya menerima Google Drive atau Google Docs.");
    }
    return url.toString();
}
let EvidenceLinkController = class EvidenceLinkController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    async createLink(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        const auditQuestionId = String(body.auditQuestionId ?? "").trim();
        const title = String(body.title ?? "").trim();
        if (!auditQuestionId) {
            throw new common_1.BadRequestException("Pertanyaan audit untuk link bukti wajib dipilih.");
        }
        if (!title) {
            throw new common_1.BadRequestException("Nama file atau dokumen wajib diisi.");
        }
        const url = googleDriveUrl(body.url);
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
            if (!["RETURNED", "OPEN", "IN_PROGRESS", "FIELD_PENDING"].includes(question.assessment?.responseStatus || "")) {
                throw new common_1.BadRequestException("Link bukti perbaikan hanya dapat ditambahkan pada butir yang masih dapat diperbaiki.");
            }
        }
        else {
            throw new common_1.BadRequestException("Penambahan link bukti tidak tersedia pada tahap audit saat ini.");
        }
        const count = await this.flow.prisma.evidence.count();
        const evidence = await this.flow.prisma.evidence.create({
            data: {
                code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
                workspaceId: id,
                auditQuestionId,
                evidenceType: "LINK",
                title,
                description: String(body.description ?? "").trim() || null,
                fileName: title,
                mimeType: "text/uri-list",
                fileSizeBytes: 0,
                storageKey: url,
                checksum: (0, node_crypto_1.createHash)("sha256").update(url).digest("hex"),
                uploadedById: user.id,
                confidentiality: body.confidentiality || "INTERNAL",
            },
        });
        await this.flow.log(user.id, user.username, "ASSESSMENT_EVIDENCE_LINK_ADDED", "Evidence", evidence.id, id, { auditQuestionId, title, url });
        return evidence;
    }
};
exports.EvidenceLinkController = EvidenceLinkController;
__decorate([
    (0, common_1.Post)("workspaces/:id/assessment-evidences/link"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], EvidenceLinkController.prototype, "createLink", null);
exports.EvidenceLinkController = EvidenceLinkController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], EvidenceLinkController);
//# sourceMappingURL=evidence-link.controller.js.map