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
exports.InstrumentExcelCompatibilityController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const auth_1 = require("./auth");
const instrument_excel_controller_1 = require("./instrument-excel.controller");
const prisma_service_1 = require("./prisma.service");
const JSZip = require("jszip");
const SPREADSHEET_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeSpreadsheetNamespace(xml) {
    const root = xml.match(new RegExp(`<([A-Za-z_][\\w.-]*):[A-Za-z_][\\w.-]*\\b[^>]*xmlns:\\1=["']${escapeRegex(SPREADSHEET_NAMESPACE)}["']`));
    if (!root)
        return xml;
    const prefix = root[1];
    const escapedPrefix = escapeRegex(prefix);
    return xml
        .replace(new RegExp(`(<\\/?)(?:${escapedPrefix}):`, "g"), "$1")
        .replace(new RegExp(`\\sxmlns:${escapedPrefix}=["']${escapeRegex(SPREADSHEET_NAMESPACE)}["']`), ` xmlns="${SPREADSHEET_NAMESPACE}"`);
}
function normalizeRelationshipTargets(xml, path) {
    return xml.replace(/Target=(["'])\/xl\/([^"']+)\1/g, (_match, quote, target) => {
        if (path === "_rels/.rels") {
            return `Target=${quote}xl/${target}${quote}`;
        }
        if (path === "xl/_rels/workbook.xml.rels") {
            return `Target=${quote}${target}${quote}`;
        }
        if (path.startsWith("xl/worksheets/_rels/")) {
            return `Target=${quote}../${target}${quote}`;
        }
        return `Target=${quote}/xl/${target}${quote}`;
    });
}
async function normalizeOoxmlPackage(buffer) {
    let zip;
    try {
        zip = await JSZip.loadAsync(buffer);
    }
    catch {
        throw new common_1.BadRequestException("File .xlsx tidak mempunyai struktur ZIP Open XML yang valid.");
    }
    let changed = false;
    const paths = Object.keys(zip.files || {});
    for (const path of paths) {
        if (!path.endsWith(".xml") && !path.endsWith(".rels"))
            continue;
        const entry = zip.file(path);
        if (!entry)
            continue;
        const original = await entry.async("string");
        let normalized = original.replace(/^\uFEFF/, "");
        if (path.endsWith(".xml")) {
            normalized = normalizeSpreadsheetNamespace(normalized);
        }
        if (path.endsWith(".rels")) {
            normalized = normalizeRelationshipTargets(normalized, path);
        }
        if (normalized !== original) {
            zip.file(path, normalized);
            changed = true;
        }
    }
    if (!changed)
        return { buffer, changed: false };
    const normalizedBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
    return { buffer: Buffer.from(normalizedBuffer), changed: true };
}
let InstrumentExcelCompatibilityController = class InstrumentExcelCompatibilityController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async importQuestions(file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException("File Excel wajib dipilih.");
        }
        const normalized = await normalizeOoxmlPackage(Buffer.from(file.buffer));
        const importer = new instrument_excel_controller_1.InstrumentExcelController(this.prisma);
        const result = await importer.importQuestions({
            ...file,
            buffer: normalized.buffer,
        });
        return {
            ...result,
            compatibilityNormalized: normalized.changed,
        };
    }
};
exports.InstrumentExcelCompatibilityController = InstrumentExcelCompatibilityController;
__decorate([
    (0, common_1.Post)("master-admin/questions/import"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", {
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InstrumentExcelCompatibilityController.prototype, "importQuestions", null);
exports.InstrumentExcelCompatibilityController = InstrumentExcelCompatibilityController = __decorate([
    (0, common_1.Controller)(),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InstrumentExcelCompatibilityController);
//# sourceMappingURL=instrument-excel-compat.controller.js.map