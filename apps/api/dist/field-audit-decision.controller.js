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
exports.FieldAuditDecisionController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
const STANDARD_RESULTS = new Set([
    "MELAMPAUI",
    "TERCAPAI",
    "TIDAK_TERCAPAI",
    "BELUM_DIUKUR",
]);
const PROCESS_RESULTS = new Set([
    "C",
    "OBS",
    "KTS_MINOR",
    "KTS_MAYOR",
    "NA",
]);
const STANDARD_FINDINGS = new Set(["TIDAK_TERCAPAI", "BELUM_DIUKUR"]);
const PROCESS_FINDINGS = new Set(["OBS", "KTS_MINOR", "KTS_MAYOR", "NA"]);
const FINDING_TYPES = new Set(["OBS", "KTS_MINOR", "KTS_MAYOR"]);
let FieldAuditDecisionController = class FieldAuditDecisionController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    async decide(id, body, user) {
        const assessment = await this.flow.prisma.selfAssessment.findUnique({
            where: { id },
            include: {
                question: {
                    include: {
                        workspace: { include: { team: true } },
                        masterQuestion: { include: { standard: true, isoClause: true } },
                        findings: true,
                    },
                },
            },
        });
        if (!assessment) {
            throw new common_1.BadRequestException("Butir assessment tidak ditemukan.");
        }
        const workspace = assessment.question.workspace;
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
        await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");
        const master = assessment.question.masterQuestion;
        const isIso = Boolean(master.isoClauseId || master.isoClause) ||
            master.criterionSource === "ISO_9001";
        const note = String(body.note || "").trim();
        if (!note) {
            throw new common_1.BadRequestException("Catatan hasil assessment lapangan wajib diisi.");
        }
        let standardResult = null;
        let processResult = null;
        if (isIso) {
            processResult = String(body.processResult || "")
                .trim()
                .toUpperCase()
                .replace("NC_MINOR", "KTS_MINOR")
                .replace("NC_MAJOR", "KTS_MAYOR");
            if (!PROCESS_RESULTS.has(processResult)) {
                throw new common_1.BadRequestException("Butir ISO hanya dapat dinilai C, OBS, KTS/NC Minor, KTS/NC Mayor, atau NA.");
            }
        }
        else {
            standardResult = String(body.standardResult || "")
                .trim()
                .toUpperCase()
                .replace("BELUM_DIKERJAKAN", "BELUM_DIUKUR");
            if (!STANDARD_RESULTS.has(standardResult)) {
                throw new common_1.BadRequestException("Butir SPMI hanya dapat dinilai Melampaui, Tercapai, Tidak Tercapai, atau Belum Diukur.");
            }
        }
        const result = standardResult || processResult;
        const requiresFinding = isIso
            ? PROCESS_FINDINGS.has(processResult)
            : STANDARD_FINDINGS.has(standardResult);
        const sampleDescription = String(body.sampleDescription || "").trim();
        const interviewee = String(body.interviewee || "").trim();
        const objectiveEvidence = String(body.objectiveEvidence || "").trim();
        const auditorAnalysis = String(body.auditorAnalysis || "").trim();
        if (!objectiveEvidence || !auditorAnalysis) {
            throw new common_1.BadRequestException("Bukti objektif dan analisis Auditor wajib diisi sebagai kertas kerja assessment lapangan.");
        }
        const existingWorkpaper = await this.flow.prisma.workpaper.findUnique({
            where: {
                auditQuestionId_auditorUserId: {
                    auditQuestionId: assessment.auditQuestionId,
                    auditorUserId: user.id,
                },
            },
        });
        if (existingWorkpaper &&
            !["DRAFT", "RETURNED"].includes(existingWorkpaper.documentStatus)) {
            throw new common_1.BadRequestException("Kertas kerja telah diajukan atau disetujui dan tidak dapat diubah.");
        }
        let dueDate = null;
        let findingType = null;
        let findingData = null;
        if (requiresFinding) {
            dueDate = new Date(String(body.dueDate || ""));
            if (Number.isNaN(dueDate.getTime())) {
                throw new common_1.BadRequestException("Kategori ini otomatis menjadi temuan. Batas waktu perbaikan wajib diisi.");
            }
            const requestedFindingType = String(body.findingType ||
                (standardResult === "BELUM_DIUKUR" || processResult === "NA"
                    ? "OBS"
                    : "KTS_MINOR"))
                .trim()
                .toUpperCase()
                .replace("NC_MINOR", "KTS_MINOR")
                .replace("NC_MAJOR", "KTS_MAYOR");
            findingType =
                isIso && processResult !== "NA" ? processResult : requestedFindingType;
            if (!FINDING_TYPES.has(findingType)) {
                throw new common_1.BadRequestException("Klasifikasi temuan harus OBS, KTS/NC Minor, atau KTS/NC Mayor.");
            }
            const condition = String(body.condition || note).trim();
            const gapStatement = String(body.gapStatement || note).trim();
            const riskImpact = String(body.riskImpact || "Perlu perbaikan sesuai batas waktu.").trim();
            if (!condition || !gapStatement || !riskImpact) {
                throw new common_1.BadRequestException("Kondisi, kesenjangan, dan dampak risiko wajib diisi untuk temuan audit.");
            }
            findingData = {
                findingType,
                criteriaRegulation: String(body.criteriaRegulation || "").trim() ||
                    master.standard?.title ||
                    "Standar SPMI/Internal",
                criteriaIso: String(body.criteriaIso || "").trim() || master.isoClause?.code || "—",
                condition,
                objectiveEvidence,
                gapStatement,
                riskImpact,
                dueDate,
                status: "OPEN",
            };
        }
        const existingFinding = assessment.question.findings.find((item) => item.status === "OPEN");
        const findingCount = requiresFinding
            ? await this.flow.prisma.finding.count({
                where: { workspaceId: workspace.id },
            })
            : 0;
        const workpaperAuditStatus = isIso
            ? processResult
            : requiresFinding
                ? findingType
                : "C";
        await this.flow.prisma.$transaction(async (transaction) => {
            await transaction.selfAssessment.update({
                where: { id },
                data: {
                    responseStatus: requiresFinding ? "OPEN" : "APPROVED",
                    standardResult,
                    processResult,
                    approvedById: user.id,
                    approvedAt: new Date(),
                    returnNote: note,
                    score: null,
                },
            });
            await transaction.workpaper.upsert({
                where: {
                    auditQuestionId_auditorUserId: {
                        auditQuestionId: assessment.auditQuestionId,
                        auditorUserId: user.id,
                    },
                },
                create: {
                    auditQuestionId: assessment.auditQuestionId,
                    auditorUserId: user.id,
                    sampleDescription: sampleDescription || null,
                    interviewee: interviewee || null,
                    objectiveEvidence,
                    auditorAnalysis,
                    auditStatus: workpaperAuditStatus,
                    standardResult,
                    processResult,
                    documentStatus: "DRAFT",
                },
                update: {
                    sampleDescription: sampleDescription || null,
                    interviewee: interviewee || null,
                    objectiveEvidence,
                    auditorAnalysis,
                    auditStatus: workpaperAuditStatus,
                    standardResult,
                    processResult,
                    documentStatus: "DRAFT",
                },
            });
            if (requiresFinding) {
                if (existingFinding) {
                    await transaction.finding.update({
                        where: { id: existingFinding.id },
                        data: findingData,
                    });
                }
                else {
                    await transaction.finding.create({
                        data: {
                            ...findingData,
                            code: `FND-${workspace.auditYear}-${String(findingCount + 1).padStart(5, "0")}`,
                            workspaceId: workspace.id,
                            auditQuestionId: assessment.auditQuestionId,
                        },
                    });
                }
            }
            else {
                await transaction.finding.updateMany({
                    where: {
                        workspaceId: workspace.id,
                        auditQuestionId: assessment.auditQuestionId,
                        status: "OPEN",
                    },
                    data: { status: "CLOSED" },
                });
            }
            await transaction.activityLog.create({
                data: {
                    userId: user.id,
                    username: user.username,
                    action: requiresFinding
                        ? "FIELD_ASSESSMENT_FINDING_OPENED"
                        : "FIELD_ASSESSMENT_ITEM_COMPLETED",
                    entityType: "SelfAssessment",
                    entityId: id,
                    workspaceId: workspace.id,
                    result: "SUCCESS",
                    newValue: {
                        sourceType: isIso ? "ISO" : "SPMI",
                        category: result,
                        requiresFinding,
                        findingType,
                        dueDate: dueDate?.toISOString() || null,
                    },
                },
            });
        });
        return {
            ok: true,
            status: requiresFinding ? "OPEN" : "APPROVED",
            sourceType: isIso ? "ISO" : "SPMI",
            result,
            requiresFinding,
            findingType,
            dueDate: dueDate?.toISOString() || null,
        };
    }
};
exports.FieldAuditDecisionController = FieldAuditDecisionController;
__decorate([
    (0, common_1.Post)("assessments/:id/field-decision"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], FieldAuditDecisionController.prototype, "decide", null);
exports.FieldAuditDecisionController = FieldAuditDecisionController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], FieldAuditDecisionController);
//# sourceMappingURL=field-audit-decision.controller.js.map