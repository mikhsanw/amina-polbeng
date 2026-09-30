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
exports.AuditArchiveController = exports.SIGNED_ARCHIVE_MARKER = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
exports.SIGNED_ARCHIVE_MARKER = "AUDIT_ARCHIVE_SIGNED_REPORT";
let AuditArchiveController = class AuditArchiveController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    requireUploader(workspace, user) {
        if (this.flow.hasRole(user, ["SUPER_ADMIN", "ADMIN_MUTU"]))
            return;
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    }
    async list(id, user) {
        const workspace = await this.flow.workspace(id, user);
        const [documents, openFindings, reportCount] = await Promise.all([
            this.flow.prisma.evidence.findMany({
                where: {
                    workspaceId: id,
                    auditQuestionId: null,
                    description: exports.SIGNED_ARCHIVE_MARKER,
                    deletedAt: null,
                },
                include: { uploadedBy: { select: { id: true, fullName: true } } },
                orderBy: { uploadedAt: "desc" },
            }),
            this.flow.prisma.finding.count({
                where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
            }),
            this.flow.prisma.printDocument.count({
                where: { workspaceId: id, type: "AUDIT_REPORT" },
            }),
        ]);
        return { workspace, documents, openFindings, reportCount };
    }
    async upload(id, file, body, user) {
        if (!file)
            throw new common_1.BadRequestException("Dokumen arsip wajib dipilih.");
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
        this.requireUploader(workspace, user);
        const reportCount = await this.flow.prisma.printDocument.count({
            where: { workspaceId: id, type: "AUDIT_REPORT" },
        });
        if (!reportCount) {
            throw new common_1.BadRequestException("Buat dan unduh minimal satu versi laporan PDF sebelum mengunggah dokumen bertanda tangan ke Archive.");
        }
        const extension = (0, node_path_1.extname)(String(file.originalname || "")).toLowerCase();
        if (file.mimetype !== "application/pdf" && extension !== ".pdf") {
            throw new common_1.BadRequestException("Dokumen arsip bertanda tangan harus dalam format PDF.");
        }
        const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
        if (!file.buffer?.length || file.buffer.length > maxBytes) {
            throw new common_1.BadRequestException(`Ukuran PDF maksimal ${process.env.MAX_UPLOAD_MB ?? 20} MB.`);
        }
        const directory = (0, node_path_1.join)(process.cwd(), "storage", "audits", String(workspace.auditYear), workspace.name, "archive");
        await (0, promises_1.mkdir)(directory, { recursive: true });
        const safeName = `${Date.now()}-${String(file.originalname).replace(/[^\w.-]/g, "_")}`;
        await (0, promises_1.writeFile)((0, node_path_1.join)(directory, safeName), file.buffer);
        const document = await this.flow.prisma.evidence.create({
            data: {
                code: `ARC-${workspace.auditYear}-${Date.now()}`,
                workspaceId: id,
                auditQuestionId: null,
                evidenceType: "REPORT",
                title: String(body.title || "Laporan AMI Bertanda Tangan").trim(),
                description: exports.SIGNED_ARCHIVE_MARKER,
                fileName: file.originalname,
                mimeType: "application/pdf",
                fileSizeBytes: file.buffer.length,
                storageKey: (0, node_path_1.join)("storage", "audits", String(workspace.auditYear), workspace.name, "archive", safeName),
                checksum: (0, node_crypto_1.createHash)("sha256").update(file.buffer).digest("hex"),
                confidentiality: "INTERNAL",
                reviewStatus: "PENDING",
                uploadedById: user.id,
            },
            include: { uploadedBy: { select: { id: true, fullName: true } } },
        });
        await this.flow.log(user.id, user.username, "SIGNED_AUDIT_ARCHIVE_UPLOADED", "Evidence", document.id, id, { fileName: document.fileName, title: document.title });
        return document;
    }
    async review(id, body, user) {
        const document = await this.flow.prisma.evidence.findFirst({
            where: {
                id,
                auditQuestionId: null,
                description: exports.SIGNED_ARCHIVE_MARKER,
                deletedAt: null,
            },
        });
        if (!document)
            throw new common_1.BadRequestException("Dokumen Archive tidak ditemukan.");
        const workspace = await this.flow.workspace(document.workspaceId, user);
        this.flow.requireStatus(workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
        const decision = String(body.decision || "").trim().toUpperCase();
        if (!["VALID", "INVALID"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih keputusan Valid atau Tidak Valid.");
        }
        const note = String(body.note || "").trim();
        if (decision === "INVALID" && !note) {
            throw new common_1.BadRequestException("Catatan wajib diisi apabila dokumen Archive tidak valid.");
        }
        const updated = await this.flow.prisma.evidence.update({
            where: { id },
            data: {
                reviewStatus: decision,
                validationNote: note ||
                    (decision === "VALID"
                        ? "Dokumen bertanda tangan lengkap dan dapat diarsipkan."
                        : null),
                validatedAt: new Date(),
            },
        });
        await this.flow.log(user.id, user.username, decision === "VALID"
            ? "SIGNED_AUDIT_ARCHIVE_VALIDATED"
            : "SIGNED_AUDIT_ARCHIVE_INVALIDATED", "Evidence", id, document.workspaceId, { decision, note: note || null });
        return updated;
    }
    async remove(id, user) {
        const document = await this.flow.prisma.evidence.findFirst({
            where: {
                id,
                auditQuestionId: null,
                description: exports.SIGNED_ARCHIVE_MARKER,
                deletedAt: null,
            },
        });
        if (!document)
            throw new common_1.BadRequestException("Dokumen Archive tidak ditemukan.");
        const workspace = await this.flow.workspace(document.workspaceId, user);
        this.flow.requireStatus(workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
        this.requireUploader(workspace, user);
        const isAdmin = this.flow.hasRole(user, ["SUPER_ADMIN", "ADMIN_MUTU"]);
        if (document.uploadedById !== user.id && !isAdmin) {
            throw new common_1.ForbiddenException("Dokumen hanya dapat dihapus oleh pengunggah atau Admin Mutu.");
        }
        if (document.reviewStatus === "VALID" && !isAdmin) {
            throw new common_1.BadRequestException("Dokumen Archive yang sudah Valid dikunci.");
        }
        const target = (0, node_path_1.resolve)(process.cwd(), document.storageKey);
        const root = (0, node_path_1.resolve)(process.cwd(), "storage");
        if (target.startsWith(root))
            await (0, promises_1.unlink)(target).catch(() => undefined);
        await this.flow.prisma.evidence.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        return { ok: true };
    }
};
exports.AuditArchiveController = AuditArchiveController;
__decorate([
    (0, common_1.Get)("workspaces/:id/archive"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditArchiveController.prototype, "list", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/archive/upload"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditArchiveController.prototype, "upload", null);
__decorate([
    (0, common_1.Patch)("archive-documents/:id/review"),
    (0, auth_1.Roles)("ADMIN_MUTU", "SUPER_ADMIN"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditArchiveController.prototype, "review", null);
__decorate([
    (0, common_1.Delete)("archive-documents/:id"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditArchiveController.prototype, "remove", null);
exports.AuditArchiveController = AuditArchiveController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], AuditArchiveController);
//# sourceMappingURL=audit-archive.controller.js.map