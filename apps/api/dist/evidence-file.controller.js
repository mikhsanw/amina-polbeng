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
exports.EvidenceFileController = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
let EvidenceFileController = class EvidenceFileController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async openFile(id, download, user, response) {
        const evidence = await this.flow.prisma.evidence.findFirst({
            where: { id, deletedAt: null },
            select: {
                id: true,
                workspaceId: true,
                evidenceType: true,
                fileName: true,
                mimeType: true,
                storageKey: true,
            },
        });
        if (!evidence)
            throw new common_1.NotFoundException("Dokumen bukti tidak ditemukan.");
        await this.flow.workspace(evidence.workspaceId, user);
        if (evidence.evidenceType === "LINK") {
            let target;
            try {
                target = new URL(evidence.storageKey);
            }
            catch {
                throw new common_1.BadRequestException("Link bukti tidak valid.");
            }
            const host = target.hostname.toLowerCase();
            if (target.protocol !== "https:" ||
                !["drive.google.com", "docs.google.com"].includes(host)) {
                throw new common_1.BadRequestException("Link bukti bukan Google Drive yang valid.");
            }
            response.setHeader("Cache-Control", "private, no-store, max-age=0");
            response.redirect(target.toString());
            return;
        }
        const parts = String(evidence.storageKey || "")
            .split(/[\\/]+/)
            .filter(Boolean);
        if (!parts.length ||
            parts.some((part) => part === "." || part === ".." || part.includes(":"))) {
            throw new common_1.BadRequestException("Lokasi dokumen bukti tidak valid.");
        }
        const storageRoot = (0, node_path_1.resolve)(process.cwd(), "storage");
        const filePath = (0, node_path_1.resolve)(process.cwd(), ...parts);
        const insideStorage = (0, node_path_1.relative)(storageRoot, filePath);
        if (insideStorage.startsWith("..") ||
            (0, node_path_1.isAbsolute)(insideStorage) ||
            insideStorage === "") {
            throw new common_1.BadRequestException("Lokasi dokumen bukti berada di luar penyimpanan audit.");
        }
        let metadata;
        try {
            metadata = await (0, promises_1.stat)(filePath);
        }
        catch {
            throw new common_1.NotFoundException("File bukti tidak ditemukan pada penyimpanan. Rekaman metadata masih tersedia.");
        }
        if (!metadata.isFile()) {
            throw new common_1.NotFoundException("Dokumen bukti tidak berupa file.");
        }
        const originalName = String(evidence.fileName || "dokumen-bukti").replace(/[\r\n"]/g, "_");
        const asciiName = originalName.replace(/[^\x20-\x7E]/g, "_");
        const disposition = download === "1" ? "attachment" : "inline";
        response.setHeader("Content-Disposition", `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`);
        response.setHeader("Cache-Control", "private, no-store, max-age=0");
        response.setHeader("X-Content-Type-Options", "nosniff");
        return new common_1.StreamableFile((0, node_fs_1.createReadStream)(filePath), {
            type: evidence.mimeType || "application/octet-stream",
            length: metadata.size,
        });
    }
};
exports.EvidenceFileController = EvidenceFileController;
__decorate([
    (0, common_1.Get)(":id/file"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("download")),
    __param(2, (0, auth_1.CurrentUser)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], EvidenceFileController.prototype, "openFile", null);
exports.EvidenceFileController = EvidenceFileController = __decorate([
    (0, common_1.Controller)("audit-flow/evidences"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], EvidenceFileController);
//# sourceMappingURL=evidence-file.controller.js.map