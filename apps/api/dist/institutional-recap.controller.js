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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstitutionalRecapController = void 0;
const common_1 = require("@nestjs/common");
const exceljs_1 = __importDefault(require("exceljs"));
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const polbeng_report_pdf_1 = require("./polbeng-report-pdf");
const CLOSED_FINDING = new Set(["CLOSED", "VOID"]);
const EFFECTIVE_ACTION = new Set(["EFFECTIVE"]);
const EFFECTIVE_VERIFICATION = new Set(["EFFECTIVE", "EFFECTIVE_WITH_MONITORING"]);
const PRIORITY_ORDER = { KRITIS: 0, TINGGI: 1, MENENGAH: 2 };
function numberParam(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function textParam(value) {
    const text = String(value ?? "").trim();
    return text || undefined;
}
function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
function statusLabel(value) {
    return String(value ?? "—").replaceAll("_", " ");
}
function dateText(value) {
    if (!value)
        return "—";
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}
let InstitutionalRecapController = class InstitutionalRecapController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    parseFilters(query) {
        return {
            year: numberParam(query.year),
            programId: textParam(query.programId),
            unitId: textParam(query.unitId),
            moduleCode: textParam(query.moduleCode)?.toUpperCase(),
        };
    }
    async build(filters) {
        const workspaceWhere = {};
        if (filters.year)
            workspaceWhere.auditYear = filters.year;
        if (filters.programId)
            workspaceWhere.programId = filters.programId;
        if (filters.unitId)
            workspaceWhere.unitId = filters.unitId;
        const [workspaces, programs, units, moduleRows, yearRows] = await Promise.all([
            this.flow.prisma.auditWorkspace.findMany({
                where: workspaceWhere,
                include: {
                    unit: { select: { id: true, code: true, name: true } },
                    program: {
                        select: { id: true, code: true, name: true, auditYear: true },
                    },
                    questions: {
                        include: {
                            masterQuestion: {
                                include: { standard: true, isoClause: true },
                            },
                            workpapers: {
                                include: {
                                    auditor: {
                                        select: { id: true, fullName: true, username: true },
                                    },
                                },
                                orderBy: { updatedAt: "desc" },
                            },
                        },
                    },
                    findings: {
                        include: {
                            question: {
                                include: {
                                    masterQuestion: {
                                        include: { standard: true, isoClause: true },
                                    },
                                    workpapers: {
                                        include: {
                                            auditor: {
                                                select: { id: true, fullName: true, username: true },
                                            },
                                        },
                                        orderBy: { updatedAt: "desc" },
                                    },
                                },
                            },
                            actions: {
                                include: {
                                    verifications: { orderBy: { verificationDate: "desc" } },
                                },
                                orderBy: { updatedAt: "desc" },
                            },
                        },
                    },
                },
                orderBy: [{ auditYear: "desc" }, { unit: { name: "asc" } }],
            }),
            this.flow.prisma.auditProgram.findMany({
                orderBy: [{ auditYear: "desc" }, { name: "asc" }],
                select: { id: true, code: true, name: true, auditYear: true },
            }),
            this.flow.prisma.unit.findMany({
                where: { active: true },
                orderBy: { name: "asc" },
                select: { id: true, code: true, name: true },
            }),
            this.flow.prisma.masterQuestion.findMany({
                where: { active: true },
                distinct: ["moduleCode"],
                orderBy: { moduleCode: "asc" },
                select: { moduleCode: true },
            }),
            this.flow.prisma.auditWorkspace.findMany({
                distinct: ["auditYear"],
                orderBy: { auditYear: "desc" },
                select: { auditYear: true },
            }),
        ]);
        const now = new Date();
        const selectedWorkspaces = workspaces.map((workspace) => {
            const questions = filters.moduleCode
                ? workspace.questions.filter((question) => question.moduleCode === filters.moduleCode)
                : workspace.questions;
            const questionIds = new Set(questions.map((question) => question.id));
            const findings = workspace.findings.filter((finding) => !filters.moduleCode ||
                (finding.auditQuestionId && questionIds.has(finding.auditQuestionId)));
            return { ...workspace, questions, findings };
        });
        const allFindings = selectedWorkspaces.flatMap((workspace) => workspace.findings.map((finding) => ({ ...finding, workspace })));
        const activeFindings = allFindings.filter((finding) => finding.status !== "VOID");
        const openFindings = activeFindings.filter((finding) => !CLOSED_FINDING.has(finding.status));
        const allActions = activeFindings.flatMap((finding) => finding.actions.map((action) => ({ ...action, finding })));
        const actionState = (action) => {
            const latestVerification = action.verifications?.[0];
            const effective = EFFECTIVE_ACTION.has(action.status) ||
                EFFECTIVE_VERIFICATION.has(latestVerification?.status);
            const overdue = !effective && new Date(action.targetDate).getTime() < now.getTime();
            return { effective, overdue, latestVerification };
        };
        const effectiveActions = allActions.filter((action) => actionState(action).effective);
        const overdueActions = allActions.filter((action) => actionState(action).overdue);
        const avgProgress = allActions.length
            ? allActions.reduce((sum, action) => sum + Number(action.progressPercent || 0), 0) / allActions.length
            : 0;
        const unitRows = selectedWorkspaces.map((workspace) => {
            const findings = workspace.findings.filter((finding) => finding.status !== "VOID");
            const open = findings.filter((finding) => !CLOSED_FINDING.has(finding.status));
            const actions = findings.flatMap((finding) => finding.actions || []);
            const effective = actions.filter((action) => actionState(action).effective).length;
            const overdue = actions.filter((action) => actionState(action).overdue).length;
            const questionCount = workspace.questions.length;
            const typeCount = (types) => findings.filter((finding) => types.includes(finding.findingType)).length;
            return {
                workspaceId: workspace.id,
                unitId: workspace.unit.id,
                unitCode: workspace.unit.code,
                unitName: workspace.unit.name,
                auditYear: workspace.auditYear,
                programName: workspace.program?.name || "Tanpa program",
                questionCount,
                total: findings.length,
                open: open.length,
                closed: findings.length - open.length,
                major: typeCount(["KTS_MAYOR", "NC_MAJOR"]),
                minor: typeCount(["KTS_MINOR", "NC_MINOR"]),
                observation: typeCount(["OBS", "OFI"]),
                findingRate: questionCount ? round((findings.length / questionCount) * 100) : 0,
                capaTotal: actions.length,
                capaEffective: effective,
                capaOverdue: overdue,
                avgProgress: actions.length
                    ? round(actions.reduce((sum, action) => sum + Number(action.progressPercent || 0), 0) / actions.length)
                    : 0,
            };
        });
        const capaStatusMap = new Map();
        for (const action of allActions) {
            const state = actionState(action);
            const key = state.overdue
                ? "OVERDUE"
                : state.effective
                    ? "EFFECTIVE"
                    : action.status;
            capaStatusMap.set(key, (capaStatusMap.get(key) || 0) + 1);
        }
        const capaByStatus = [...capaStatusMap.entries()]
            .map(([status, count]) => ({ status, label: statusLabel(status), count }))
            .sort((a, b) => b.count - a.count);
        const heatmapUnits = unitRows.map((row) => ({
            id: row.unitId,
            code: row.unitCode,
            name: row.unitName,
        }));
        const moduleCodes = [
            ...new Set(selectedWorkspaces.flatMap((workspace) => workspace.questions.map((question) => question.moduleCode))),
        ].sort();
        const heatmapRows = moduleCodes.map((moduleCode) => {
            const cells = selectedWorkspaces.map((workspace) => {
                const findings = workspace.findings.filter((finding) => finding.status !== "VOID" &&
                    finding.question?.moduleCode === moduleCode);
                return {
                    unitId: workspace.unit.id,
                    count: findings.length,
                    open: findings.filter((finding) => !CLOSED_FINDING.has(finding.status)).length,
                    major: findings.filter((finding) => ["KTS_MAYOR", "NC_MAJOR"].includes(finding.findingType)).length,
                };
            });
            return { moduleCode, cells };
        });
        const maxHeatmapCount = Math.max(1, ...heatmapRows.flatMap((row) => row.cells.map((cell) => cell.count)));
        const overdueCapa = overdueActions
            .map((action) => ({
            id: action.id,
            findingCode: action.finding.code,
            findingType: action.finding.findingType,
            unitCode: action.finding.workspace.unit.code,
            unitName: action.finding.workspace.unit.name,
            moduleCode: action.finding.question?.moduleCode || "LAINNYA",
            correctiveAction: action.correctiveAction,
            rootCause: action.rootCauseStatement,
            successIndicator: action.successIndicator,
            targetDate: action.targetDate,
            daysLate: Math.max(1, Math.floor((now.getTime() - new Date(action.targetDate).getTime()) /
                (24 * 60 * 60 * 1000))),
            progressPercent: action.progressPercent,
            status: action.status,
        }))
            .sort((a, b) => b.daysLate - a.daysLate);
        const auditorInsights = activeFindings.map((finding) => {
            const workpapers = finding.question?.workpapers || [];
            const workpaper = workpapers.find((item) => ["APPROVED", "LOCKED"].includes(item.documentStatus)) || workpapers[0];
            const action = finding.actions?.[0];
            const recommendation = action?.correctiveAction
                ? action.correctiveAction
                : `Perbaiki kesenjangan: ${finding.gapStatement}`;
            return {
                findingId: finding.id,
                findingCode: finding.code,
                unitCode: finding.workspace.unit.code,
                unitName: finding.workspace.unit.name,
                moduleCode: finding.question?.moduleCode || "LAINNYA",
                findingType: finding.findingType,
                status: finding.status,
                condition: finding.condition,
                riskImpact: finding.riskImpact,
                auditorName: workpaper?.auditor?.fullName || "Belum ditetapkan",
                auditorAnalysis: workpaper?.auditorAnalysis ||
                    "Analisis Auditor belum tersedia pada kertas kerja final.",
                recommendation,
                capaStatus: action?.status || "BELUM ADA CAPA",
                progressPercent: action?.progressPercent || 0,
            };
        });
        const planGroups = new Map();
        for (const insight of auditorInsights) {
            const key = insight.moduleCode;
            const current = planGroups.get(key) || {
                moduleCode: key,
                units: new Set(),
                findingCount: 0,
                openCount: 0,
                majorCount: 0,
                overdueCount: 0,
                recommendations: [],
                indicators: [],
                targetDates: [],
            };
            current.units.add(insight.unitName);
            current.findingCount += 1;
            if (!CLOSED_FINDING.has(insight.status))
                current.openCount += 1;
            if (["KTS_MAYOR", "NC_MAJOR"].includes(insight.findingType)) {
                current.majorCount += 1;
            }
            const finding = activeFindings.find((item) => item.id === insight.findingId);
            for (const action of finding?.actions || []) {
                const state = actionState(action);
                if (state.overdue)
                    current.overdueCount += 1;
                if (action.successIndicator)
                    current.indicators.push(action.successIndicator);
                if (action.targetDate)
                    current.targetDates.push(new Date(action.targetDate));
            }
            if (insight.recommendation)
                current.recommendations.push(insight.recommendation);
            planGroups.set(key, current);
        }
        const workPlan = [...planGroups.values()]
            .map((group) => {
            const affectedUnits = [...group.units];
            const priority = group.majorCount > 0 || group.overdueCount >= 2 || affectedUnits.length >= 3
                ? "KRITIS"
                : group.overdueCount > 0 || group.openCount >= 3
                    ? "TINGGI"
                    : "MENENGAH";
            const targetDate = group.targetDates.length
                ? new Date(Math.min(...group.targetDates.map((value) => value.getTime())))
                : null;
            return {
                priority,
                moduleCode: group.moduleCode,
                affectedUnits,
                findingCount: group.findingCount,
                openCount: group.openCount,
                majorCount: group.majorCount,
                overdueCount: group.overdueCount,
                recommendedAction: group.recommendations[0] ||
                    `Susun perbaikan institusional untuk unsur ${group.moduleCode}.`,
                successIndicator: group.indicators[0] ||
                    "Seluruh CAPA pada unsur ini efektif dan temuan berulang menurun.",
                targetDate,
            };
        })
            .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            b.findingCount - a.findingCount);
        return {
            generatedAt: new Date().toISOString(),
            appliedFilters: filters,
            filters: {
                years: yearRows.map((row) => row.auditYear),
                programs,
                units,
                modules: moduleRows.map((row) => row.moduleCode),
            },
            kpis: {
                unitsAudited: selectedWorkspaces.length,
                totalQuestions: selectedWorkspaces.reduce((sum, workspace) => sum + workspace.questions.length, 0),
                totalFindings: activeFindings.length,
                openFindings: openFindings.length,
                closedFindings: activeFindings.length - openFindings.length,
                capaTotal: allActions.length,
                capaEffective: effectiveActions.length,
                capaOverdue: overdueActions.length,
                avgCapaProgress: round(avgProgress),
                closureRate: allActions.length
                    ? round((effectiveActions.length / allActions.length) * 100)
                    : 0,
            },
            findingsByUnit: unitRows.sort((a, b) => b.total - a.total || b.findingRate - a.findingRate),
            capaByStatus,
            unitProgress: unitRows.sort((a, b) => b.capaOverdue - a.capaOverdue || a.avgProgress - b.avgProgress),
            heatmap: {
                units: heatmapUnits,
                rows: heatmapRows,
                maxCount: maxHeatmapCount,
            },
            overdueCapa,
            auditorInsights,
            workPlan,
        };
    }
    async recap(query, _user) {
        return this.build(this.parseFilters(query));
    }
    async exportExcel(query, response) {
        const data = await this.build(this.parseFilters(query));
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = "SAMI-NONAK POLBENG";
        const summary = workbook.addWorksheet("Ringkasan");
        summary.addRows([
            ["REKAP INSTITUSI AMI NONAKADEMIK"],
            ["Dihasilkan", new Date(data.generatedAt)],
            [],
            ["Indikator", "Nilai"],
            ["Unit diaudit", data.kpis.unitsAudited],
            ["Butir audit", data.kpis.totalQuestions],
            ["Total temuan", data.kpis.totalFindings],
            ["Temuan terbuka", data.kpis.openFindings],
            ["CAPA efektif", data.kpis.capaEffective],
            ["CAPA terlambat", data.kpis.capaOverdue],
            ["Rata-rata progres CAPA", `${data.kpis.avgCapaProgress}%`],
            ["Tingkat efektivitas", `${data.kpis.closureRate}%`],
        ]);
        summary.getRow(1).font = { bold: true, size: 16 };
        summary.getRow(4).font = { bold: true };
        summary.columns = [{ width: 34 }, { width: 24 }];
        const unitSheet = workbook.addWorksheet("Temuan per Unit");
        unitSheet.addRow([
            "Unit",
            "Pertanyaan",
            "Total",
            "Terbuka",
            "Mayor",
            "Minor",
            "OBS/OFI",
            "Rasio Temuan (%)",
            "Progres CAPA (%)",
            "CAPA Terlambat",
        ]);
        data.findingsByUnit.forEach((row) => unitSheet.addRow([
            `${row.unitCode} · ${row.unitName}`,
            row.questionCount,
            row.total,
            row.open,
            row.major,
            row.minor,
            row.observation,
            row.findingRate,
            row.avgProgress,
            row.capaOverdue,
        ]));
        const overdueSheet = workbook.addWorksheet("CAPA Terlambat");
        overdueSheet.addRow([
            "Temuan",
            "Unit",
            "Unsur",
            "Tindakan",
            "Akar Masalah",
            "Target",
            "Hari Terlambat",
            "Progres (%)",
            "Status",
        ]);
        data.overdueCapa.forEach((row) => overdueSheet.addRow([
            row.findingCode,
            `${row.unitCode} · ${row.unitName}`,
            row.moduleCode,
            row.correctiveAction,
            row.rootCause,
            new Date(row.targetDate),
            row.daysLate,
            row.progressPercent,
            row.status,
        ]));
        const insightSheet = workbook.addWorksheet("Analisis Auditor");
        insightSheet.addRow([
            "Temuan",
            "Unit",
            "Unsur",
            "Jenis",
            "Auditor",
            "Analisis",
            "Arah Rekomendasi",
            "Status CAPA",
            "Progres (%)",
        ]);
        data.auditorInsights.forEach((row) => insightSheet.addRow([
            row.findingCode,
            `${row.unitCode} · ${row.unitName}`,
            row.moduleCode,
            row.findingType,
            row.auditorName,
            row.auditorAnalysis,
            row.recommendation,
            row.capaStatus,
            row.progressPercent,
        ]));
        const planSheet = workbook.addWorksheet("Rencana Kerja");
        planSheet.addRow([
            "Prioritas",
            "Unsur",
            "Unit Terdampak",
            "Temuan",
            "Terbuka",
            "Mayor",
            "CAPA Terlambat",
            "Rencana Perbaikan",
            "Indikator Keberhasilan",
            "Target",
        ]);
        data.workPlan.forEach((row) => planSheet.addRow([
            row.priority,
            row.moduleCode,
            row.affectedUnits.join("; "),
            row.findingCount,
            row.openCount,
            row.majorCount,
            row.overdueCount,
            row.recommendedAction,
            row.successIndicator,
            row.targetDate ? new Date(row.targetDate) : "",
        ]));
        const heatmapSheet = workbook.addWorksheet("Heatmap Unsur-Unit");
        heatmapSheet.addRow([
            "Unsur",
            ...data.heatmap.units.map((unit) => unit.code),
        ]);
        data.heatmap.rows.forEach((row) => heatmapSheet.addRow([
            row.moduleCode,
            ...data.heatmap.units.map((unit) => row.cells.find((cell) => cell.unitId === unit.id)?.count || 0),
        ]));
        for (const sheet of workbook.worksheets) {
            sheet.views = [{ state: "frozen", ySplit: sheet.name === "Ringkasan" ? 0 : 1 }];
            sheet.getRow(sheet.name === "Ringkasan" ? 4 : 1).font = { bold: true };
            sheet.columns.forEach((column) => {
                column.width = Math.max(column.width || 12, 16);
                column.alignment = { vertical: "top", wrapText: true };
            });
            if (sheet.name !== "Ringkasan") {
                sheet.autoFilter = {
                    from: { row: 1, column: 1 },
                    to: { row: 1, column: sheet.columnCount },
                };
            }
        }
        const buffer = await workbook.xlsx.writeBuffer();
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", 'attachment; filename="Rekap_Institusi_SAMI_NONAK.xlsx"');
        response.send(Buffer.from(buffer));
    }
    async exportPdf(query, response) {
        const data = await this.build(this.parseFilters(query));
        const lines = [
            "REKAP INSTITUSI AMI NONAKADEMIK",
            "POLITEKNIK NEGERI BENGKALIS",
            "",
            `Dihasilkan: ${dateText(data.generatedAt)}`,
            "",
            "RINGKASAN INSTITUSI",
            `Unit diaudit: ${data.kpis.unitsAudited}`,
            `Butir audit: ${data.kpis.totalQuestions}`,
            `Total temuan: ${data.kpis.totalFindings}`,
            `Temuan terbuka: ${data.kpis.openFindings}`,
            `CAPA efektif: ${data.kpis.capaEffective}`,
            `CAPA terlambat: ${data.kpis.capaOverdue}`,
            `Rata-rata progres CAPA: ${data.kpis.avgCapaProgress}%`,
            `Tingkat efektivitas: ${data.kpis.closureRate}%`,
            "",
            "TEMUAN PER UNIT",
            ...data.findingsByUnit.flatMap((row) => [
                `${row.unitCode} - ${row.unitName}`,
                `  Temuan ${row.total}; terbuka ${row.open}; mayor ${row.major}; rasio ${row.findingRate}%`,
                `  CAPA efektif ${row.capaEffective}/${row.capaTotal}; terlambat ${row.capaOverdue}; progres ${row.avgProgress}%`,
            ]),
            "",
            "CAPA TERLAMBAT",
            ...(data.overdueCapa.length
                ? data.overdueCapa.flatMap((row) => [
                    `${row.findingCode} | ${row.unitCode} | ${row.moduleCode}`,
                    `  ${row.daysLate} hari terlambat; progres ${row.progressPercent}%; target ${dateText(row.targetDate)}`,
                    `  ${row.correctiveAction}`,
                ])
                : ["Tidak ada CAPA terlambat pada filter yang dipilih."]),
            "",
            "RENCANA KERJA PRIORITAS",
            ...(data.workPlan.length
                ? data.workPlan.flatMap((row) => [
                    `${row.priority} | ${row.moduleCode} | ${row.affectedUnits.join(", ")}`,
                    `  Temuan ${row.findingCount}; terbuka ${row.openCount}; mayor ${row.majorCount}; terlambat ${row.overdueCount}`,
                    `  Rencana: ${row.recommendedAction}`,
                    `  Indikator: ${row.successIndicator}`,
                ])
                : ["Belum ada temuan untuk disusun menjadi rencana kerja."]),
        ];
        const pdf = (0, polbeng_report_pdf_1.createPdfWithPolbengLogo)(lines);
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", 'attachment; filename="Rekap_Institusi_SAMI_NONAK.pdf"');
        response.send(pdf);
    }
};
exports.InstitutionalRecapController = InstitutionalRecapController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InstitutionalRecapController.prototype, "recap", null);
__decorate([
    (0, common_1.Get)("export.xlsx"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InstitutionalRecapController.prototype, "exportExcel", null);
__decorate([
    (0, common_1.Get)("export.pdf"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InstitutionalRecapController.prototype, "exportPdf", null);
exports.InstitutionalRecapController = InstitutionalRecapController = __decorate([
    (0, common_1.Controller)("institutional-recap"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], InstitutionalRecapController);
//# sourceMappingURL=institutional-recap.controller.js.map