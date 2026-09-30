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
exports.ReportDocumentController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const capa_verification_controller_1 = require("./capa-verification.controller");
const report_activity_presenter_1 = require("./report-activity-presenter");
const polbeng_report_pdf_1 = require("./polbeng-report-pdf");
function plain(value) {
    return String(value ?? "—")
        .replaceAll("_", " ")
        .replace(/[–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function wrap(value, width = 88) {
    const text = plain(value);
    if (!text)
        return ["-"];
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
        if (!line)
            line = word;
        else if (`${line} ${word}`.length <= width)
            line += ` ${word}`;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line)
        lines.push(line);
    return lines;
}
function escapePdf(value) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function createPdf(lines) {
    const linesPerPage = 52;
    const pages = [];
    for (let index = 0; index < lines.length; index += linesPerPage) {
        pages.push(lines.slice(index, index + linesPerPage));
    }
    if (!pages.length)
        pages.push(["Laporan audit belum memiliki isi."]);
    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    const pageObjectIds = [];
    pages.forEach((pageLines, pageIndex) => {
        const pageId = 4 + pageIndex * 2;
        const contentId = pageId + 1;
        pageObjectIds.push(pageId);
        const commands = [
            "BT",
            "/F1 10 Tf",
            "48 795 Td",
            "14 TL",
            ...pageLines.map((line) => `(${escapePdf(line)}) Tj T*`),
            "() Tj T*",
            `(Halaman ${pageIndex + 1} dari ${pages.length}) Tj`,
            "ET",
        ].join("\n");
        objects[pageId] =
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
                `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
        objects[contentId] = `<< /Length ${Buffer.byteLength(commands, "ascii")} >>\nstream\n${commands}\nendstream`;
    });
    objects[2] = `<< /Type /Pages /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] /Count ${pageObjectIds.length} >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
        offsets[id] = Buffer.byteLength(pdf, "ascii");
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, "ascii");
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += "0000000000 65535 f \n";
    for (let id = 1; id < objects.length; id += 1) {
        pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "ascii");
}
let ReportDocumentController = class ReportDocumentController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async download(id, download, user, response) {
        const record = await this.flow.prisma.printDocument.findUnique({
            where: { id },
            include: {
                workspace: {
                    include: {
                        unit: true,
                        program: true,
                        team: {
                            include: { user: { select: { id: true, fullName: true } } },
                        },
                        questions: {
                            where: { reviewStatus: "PUBLISHED", excluded: false },
                            include: {
                                assessment: true,
                                masterQuestion: { include: { standard: true, isoClause: true } },
                                workpapers: {
                                    include: { auditor: { select: { fullName: true } } },
                                },
                            },
                            orderBy: { sortOrder: "asc" },
                        },
                        findings: {
                            include: {
                                actions: {
                                    include: {
                                        verifications: { orderBy: { verificationDate: "asc" } },
                                    },
                                    orderBy: { updatedAt: "desc" },
                                },
                            },
                            orderBy: { code: "asc" },
                        },
                        evidences: {
                            where: {
                                deletedAt: null,
                                description: { startsWith: capa_verification_controller_1.CAPA_EVIDENCE_MARKER },
                            },
                            orderBy: { uploadedAt: "asc" },
                        },
                        activityLogs: { orderBy: { createdAt: "asc" } },
                    },
                },
            },
        });
        if (!record)
            throw new common_1.NotFoundException("Versi laporan tidak ditemukan.");
        await this.flow.workspace(record.workspaceId, user);
        const workspace = record.workspace;
        const auditeeApprover = await this.flow.prisma.user.findFirst({
            where: {
                unitId: workspace.unitId,
                status: "ACTIVE",
                deletedAt: null,
                isUnitApprover: true,
                roles: { some: { role: { code: "AUDITEE" } } },
            },
            select: { fullName: true },
        });
        const lead = workspace.team.find((member) => member.role === "LEAD_AUDITOR");
        const auditors = workspace.team.filter((member) => member.role === "AUDITOR");
        const lines = [
            "LAPORAN AUDIT MUTU INTERNAL NONAKADEMIK",
            "POLITEKNIK NEGERI BENGKALIS",
            "",
            `Versi dokumen : ${record.version}`,
            `Program        : ${workspace.program?.code || "-"} - ${workspace.program?.name || "-"}`,
            `Unit Auditee   : ${workspace.unit.name}`,
            `Tahun audit    : ${workspace.auditYear}`,
            `Status audit   : ${plain(workspace.status)}`,
            "",
            "A. HASIL PEMERIKSAAN PER BUTIR",
        ];
        workspace.questions.forEach((question, index) => {
            const assessment = question.assessment;
            const workpaper = question.workpapers.find((item) => ["APPROVED", "LOCKED"].includes(item.documentStatus)) || question.workpapers[0];
            const result = assessment?.standardResult ||
                assessment?.processResult ||
                "BELUM DINILAI";
            lines.push("", `${index + 1}. ${plain(question.questionSnapshot)}`);
            lines.push(`   Sumber : ${question.masterQuestion.isoClause ? `ISO ${question.masterQuestion.isoClause.code}` : question.masterQuestion.standard?.code || "SPMI/Internal"}`);
            lines.push(`   Hasil  : ${plain(result)}`);
            wrap(workpaper?.objectiveEvidence || "Belum ada bukti objektif.", 82).forEach((line) => lines.push(`   Bukti  : ${line}`));
            wrap(workpaper?.auditorAnalysis || "Belum ada analisis Auditor.", 82).forEach((line) => lines.push(`   Analisis: ${line}`));
        });
        lines.push("", "B. TEMUAN, CAPA, DAN STATUS TINDAK LANJ");
        if (!workspace.findings.length) {
            lines.push("Tidak terdapat temuan audit.");
        }
        else {
            workspace.findings.forEach((finding) => {
                lines.push("", `${finding.code} - ${plain(finding.findingType)} - ${plain(finding.status)}`);
                wrap(finding.condition, 82).forEach((line) => lines.push(`   Kondisi : ${line}`));
                wrap(finding.gapStatement, 82).forEach((line) => lines.push(`   Gap     : ${line}`));
                wrap(finding.riskImpact, 82).forEach((line) => lines.push(`   Dampak  : ${line}`));
                const action = finding.actions[0];
                if (!action) {
                    lines.push("   CAPA    : Belum disampaikan oleh Auditee.");
                    lines.push("   Status  : OPEN / BELUM DITINDAKLANJUTI");
                    return;
                }
                wrap(action.correctiveAction, 82).forEach((line) => lines.push(`   CAPA    : ${line}`));
                lines.push(`   Progres : ${action.progressPercent}% - ${plain(action.status)}`);
                lines.push(`   Target  : ${new Date(action.targetDate).toLocaleDateString("id-ID")}`);
                if (new Date(action.targetDate).getTime() < Date.now() &&
                    finding.status !== "CLOSED") {
                    lines.push("   Ket.    : TERLAMBAT / TEMUAN MASIH OPEN");
                }
                const capaEvidences = workspace.evidences.filter((evidence) => evidence.description === `${capa_verification_controller_1.CAPA_EVIDENCE_MARKER}${action.id}`);
                if (!capaEvidences.length) {
                    lines.push("   Bukti CAPA: Belum dilampirkan.");
                }
                else {
                    capaEvidences.forEach((evidence, evidenceIndex) => {
                        lines.push(`   Bukti CAPA ${evidenceIndex + 1}: ${plain(evidence.title)}`);
                        wrap(evidence.storageKey, 76).forEach((line) => lines.push(`      Link : ${line}`));
                    });
                }
                if (!action.verifications.length) {
                    lines.push("   Verifikasi: Belum dilakukan Auditor/Ketua Auditor.");
                }
                else {
                    action.verifications.forEach((verification, index) => {
                        lines.push(`   Verifikasi ${index + 1}: ${plain(verification.status)}${verification.decidedAt ? " - FINAL" : " - REKOMENDASI"}`);
                        wrap(verification.implementationResult, 76).forEach((line) => lines.push(`      Implementasi: ${line}`));
                        wrap(verification.effectivenessResult, 76).forEach((line) => lines.push(`      Catatan     : ${line}`));
                    });
                }
            });
        }
        lines.push("", "C. RIWAYAT PROSES AUDIT DAN CATATAN");
        if (!workspace.activityLogs.length) {
            lines.push("Belum terdapat riwayat proses audit.");
        }
        else {
            workspace.activityLogs.forEach((log, index) => {
                const activity = (0, report_activity_presenter_1.presentActivity)(log);
                lines.push("", `${index + 1}. ${plain(activity.time)} - ${plain(activity.actor)}`);
                lines.push(`   Tahap    : ${plain(activity.stage)}`);
                wrap(activity.activity, 78).forEach((line, lineIndex) => lines.push(`${lineIndex === 0 ? "   Kegiatan : " : "              "}${line}`));
                wrap(activity.note, 78).forEach((line, lineIndex) => lines.push(`${lineIndex === 0 ? "   Catatan  : " : "              "}${line}`));
            });
        }
        lines.push("", "D. PENGESAHAN", "", "Auditee / Pimpinan Unit          Ketua Auditor                 Auditor", "", "", "", "_________________________       _________________________      _________________________", `${plain(auditeeApprover?.fullName || "Belum ditetapkan").padEnd(31)}${plain(lead?.user.fullName || "Belum ditetapkan").padEnd(31)}${plain(auditors.map((item) => item.user.fullName).join(", ") || "Belum ditetapkan")}`, "", `Dokumen dibuat sistem pada ${new Date().toLocaleString("id-ID")}`);
        const pdf = (0, polbeng_report_pdf_1.createPdfWithPolbengLogo)(lines);
        const fileName = String(record.fileName ||
            `Laporan_Audit_${workspace.auditYear}_v${record.version}.pdf`).replace(/[\r\n"]/g, "_");
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", `${download === "0" ? "inline" : "attachment"}; filename="${fileName}"`);
        response.setHeader("Content-Length", String(pdf.length));
        response.setHeader("Cache-Control", "private, no-store, max-age=0");
        response.end(pdf);
    }
};
exports.ReportDocumentController = ReportDocumentController;
__decorate([
    (0, common_1.Get)("print-documents/:id/file"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("download")),
    __param(2, (0, auth_1.CurrentUser)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportDocumentController.prototype, "download", null);
exports.ReportDocumentController = ReportDocumentController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], ReportDocumentController);
//# sourceMappingURL=report-document.controller.js.map