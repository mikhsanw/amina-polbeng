import { Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";
import ExcelJS from "exceljs";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { createPdfWithPolbengLogo } from "./polbeng-report-pdf";

type RecapFilters = {
  year?: number;
  programId?: string;
  unitId?: string;
  moduleCode?: string;
};

const CLOSED_FINDING = new Set(["CLOSED", "VOID"]);
const EFFECTIVE_ACTION = new Set(["EFFECTIVE"]);
const EFFECTIVE_VERIFICATION = new Set(["EFFECTIVE", "EFFECTIVE_WITH_MONITORING"]);
const PRIORITY_ORDER: Record<string, number> = { KRITIS: 0, TINGGI: 1, MENENGAH: 2 };

function numberParam(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function textParam(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function statusLabel(value: unknown) {
  return String(value ?? "—").replaceAll("_", " ");
}

function dateText(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

@Controller("institutional-recap")
@Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN")
export class InstitutionalRecapController {
  constructor(private readonly flow: AmiWorkflowService) {}

  private parseFilters(query: Record<string, unknown>): RecapFilters {
    return {
      year: numberParam(query.year),
      programId: textParam(query.programId),
      unitId: textParam(query.unitId),
      moduleCode: textParam(query.moduleCode)?.toUpperCase(),
    };
  }

  private async build(filters: RecapFilters) {
    const workspaceWhere: any = {};
    if (filters.year) workspaceWhere.auditYear = filters.year;
    if (filters.programId) workspaceWhere.programId = filters.programId;
    if (filters.unitId) workspaceWhere.unitId = filters.unitId;

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
    const selectedWorkspaces = workspaces.map((workspace: any) => {
      const questions = filters.moduleCode
        ? workspace.questions.filter(
            (question: any) => question.moduleCode === filters.moduleCode,
          )
        : workspace.questions;
      const questionIds = new Set(questions.map((question: any) => question.id));
      const findings = workspace.findings.filter(
        (finding: any) =>
          !filters.moduleCode ||
          (finding.auditQuestionId && questionIds.has(finding.auditQuestionId)),
      );
      return { ...workspace, questions, findings };
    });

    const allFindings = selectedWorkspaces.flatMap((workspace: any) =>
      workspace.findings.map((finding: any) => ({ ...finding, workspace })),
    );
    const activeFindings = allFindings.filter(
      (finding: any) => finding.status !== "VOID",
    );
    const openFindings = activeFindings.filter(
      (finding: any) => !CLOSED_FINDING.has(finding.status),
    );
    const allActions = activeFindings.flatMap((finding: any) =>
      finding.actions.map((action: any) => ({ ...action, finding })),
    );

    const actionState = (action: any) => {
      const latestVerification = action.verifications?.[0];
      const effective =
        EFFECTIVE_ACTION.has(action.status) ||
        EFFECTIVE_VERIFICATION.has(latestVerification?.status);
      const overdue =
        !effective && new Date(action.targetDate).getTime() < now.getTime();
      return { effective, overdue, latestVerification };
    };

    const effectiveActions = allActions.filter(
      (action: any) => actionState(action).effective,
    );
    const overdueActions = allActions.filter(
      (action: any) => actionState(action).overdue,
    );
    const avgProgress = allActions.length
      ? allActions.reduce(
          (sum: number, action: any) => sum + Number(action.progressPercent || 0),
          0,
        ) / allActions.length
      : 0;

    const unitRows = selectedWorkspaces.map((workspace: any) => {
      const findings = workspace.findings.filter(
        (finding: any) => finding.status !== "VOID",
      );
      const open = findings.filter(
        (finding: any) => !CLOSED_FINDING.has(finding.status),
      );
      const actions = findings.flatMap((finding: any) => finding.actions || []);
      const effective = actions.filter(
        (action: any) => actionState(action).effective,
      ).length;
      const overdue = actions.filter(
        (action: any) => actionState(action).overdue,
      ).length;
      const questionCount = workspace.questions.length;
      const typeCount = (types: string[]) =>
        findings.filter((finding: any) => types.includes(finding.findingType)).length;
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
          ? round(
              actions.reduce(
                (sum: number, action: any) =>
                  sum + Number(action.progressPercent || 0),
                0,
              ) / actions.length,
            )
          : 0,
      };
    });

    const capaStatusMap = new Map<string, number>();
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

    const heatmapUnits = unitRows.map((row: any) => ({
      id: row.unitId,
      code: row.unitCode,
      name: row.unitName,
    }));
    const moduleCodes = [
      ...new Set(
        selectedWorkspaces.flatMap((workspace: any) =>
          workspace.questions.map((question: any) => question.moduleCode),
        ),
      ),
    ].sort();
    const heatmapRows = moduleCodes.map((moduleCode) => {
      const cells = selectedWorkspaces.map((workspace: any) => {
        const findings = workspace.findings.filter(
          (finding: any) =>
            finding.status !== "VOID" &&
            finding.question?.moduleCode === moduleCode,
        );
        return {
          unitId: workspace.unit.id,
          count: findings.length,
          open: findings.filter(
            (finding: any) => !CLOSED_FINDING.has(finding.status),
          ).length,
          major: findings.filter((finding: any) =>
            ["KTS_MAYOR", "NC_MAJOR"].includes(finding.findingType),
          ).length,
        };
      });
      return { moduleCode, cells };
    });
    const maxHeatmapCount = Math.max(
      1,
      ...heatmapRows.flatMap((row) => row.cells.map((cell) => cell.count)),
    );

    const overdueCapa = overdueActions
      .map((action: any) => ({
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
        daysLate: Math.max(
          1,
          Math.floor(
            (now.getTime() - new Date(action.targetDate).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        ),
        progressPercent: action.progressPercent,
        status: action.status,
      }))
      .sort((a, b) => b.daysLate - a.daysLate);

    const auditorInsights = activeFindings.map((finding: any) => {
      const workpapers = finding.question?.workpapers || [];
      const workpaper =
        workpapers.find((item: any) =>
          ["APPROVED", "LOCKED"].includes(item.documentStatus),
        ) || workpapers[0];
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
        auditorAnalysis:
          workpaper?.auditorAnalysis ||
          "Analisis Auditor belum tersedia pada kertas kerja final.",
        recommendation,
        capaStatus: action?.status || "BELUM ADA CAPA",
        progressPercent: action?.progressPercent || 0,
      };
    });

    const planGroups = new Map<string, any>();
    for (const insight of auditorInsights) {
      const key = insight.moduleCode;
      const current = planGroups.get(key) || {
        moduleCode: key,
        units: new Set<string>(),
        findingCount: 0,
        openCount: 0,
        majorCount: 0,
        overdueCount: 0,
        recommendations: [] as string[],
        indicators: [] as string[],
        targetDates: [] as Date[],
      };
      current.units.add(insight.unitName);
      current.findingCount += 1;
      if (!CLOSED_FINDING.has(insight.status)) current.openCount += 1;
      if (["KTS_MAYOR", "NC_MAJOR"].includes(insight.findingType)) {
        current.majorCount += 1;
      }
      const finding = activeFindings.find(
        (item: any) => item.id === insight.findingId,
      );
      for (const action of finding?.actions || []) {
        const state = actionState(action);
        if (state.overdue) current.overdueCount += 1;
        if (action.successIndicator) current.indicators.push(action.successIndicator);
        if (action.targetDate) current.targetDates.push(new Date(action.targetDate));
      }
      if (insight.recommendation) current.recommendations.push(insight.recommendation);
      planGroups.set(key, current);
    }

    const workPlan = [...planGroups.values()]
      .map((group: any) => {
        const affectedUnits = [...group.units];
        const priority =
          group.majorCount > 0 || group.overdueCount >= 2 || affectedUnits.length >= 3
            ? "KRITIS"
            : group.overdueCount > 0 || group.openCount >= 3
              ? "TINGGI"
              : "MENENGAH";
        const targetDate = group.targetDates.length
          ? new Date(
              Math.min(...group.targetDates.map((value: Date) => value.getTime())),
            )
          : null;
        return {
          priority,
          moduleCode: group.moduleCode,
          affectedUnits,
          findingCount: group.findingCount,
          openCount: group.openCount,
          majorCount: group.majorCount,
          overdueCount: group.overdueCount,
          recommendedAction:
            group.recommendations[0] ||
            `Susun perbaikan institusional untuk unsur ${group.moduleCode}.`,
          successIndicator:
            group.indicators[0] ||
            "Seluruh CAPA pada unsur ini efektif dan temuan berulang menurun.",
          targetDate,
        };
      })
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.findingCount - a.findingCount,
      );

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
        totalQuestions: selectedWorkspaces.reduce(
          (sum: number, workspace: any) => sum + workspace.questions.length,
          0,
        ),
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
      findingsByUnit: unitRows.sort(
        (a: any, b: any) => b.total - a.total || b.findingRate - a.findingRate,
      ),
      capaByStatus,
      unitProgress: unitRows.sort(
        (a: any, b: any) => b.capaOverdue - a.capaOverdue || a.avgProgress - b.avgProgress,
      ),
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

  @Get()
  async recap(
    @Query() query: Record<string, unknown>,
    @CurrentUser() _user: any,
  ) {
    return this.build(this.parseFilters(query));
  }

  @Get("export.xlsx")
  async exportExcel(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const data = await this.build(this.parseFilters(query));
    const workbook = new ExcelJS.Workbook();
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
    data.findingsByUnit.forEach((row: any) =>
      unitSheet.addRow([
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
      ]),
    );

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
    data.overdueCapa.forEach((row: any) =>
      overdueSheet.addRow([
        row.findingCode,
        `${row.unitCode} · ${row.unitName}`,
        row.moduleCode,
        row.correctiveAction,
        row.rootCause,
        new Date(row.targetDate),
        row.daysLate,
        row.progressPercent,
        row.status,
      ]),
    );

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
    data.auditorInsights.forEach((row: any) =>
      insightSheet.addRow([
        row.findingCode,
        `${row.unitCode} · ${row.unitName}`,
        row.moduleCode,
        row.findingType,
        row.auditorName,
        row.auditorAnalysis,
        row.recommendation,
        row.capaStatus,
        row.progressPercent,
      ]),
    );

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
    data.workPlan.forEach((row: any) =>
      planSheet.addRow([
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
      ]),
    );

    const heatmapSheet = workbook.addWorksheet("Heatmap Unsur-Unit");
    heatmapSheet.addRow([
      "Unsur",
      ...data.heatmap.units.map((unit: any) => unit.code),
    ]);
    data.heatmap.rows.forEach((row: any) =>
      heatmapSheet.addRow([
        row.moduleCode,
        ...data.heatmap.units.map((unit: any) =>
          row.cells.find((cell: any) => cell.unitId === unit.id)?.count || 0,
        ),
      ]),
    );

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
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="Rekap_Institusi_SAMI_NONAK.xlsx"',
    );
    response.send(Buffer.from(buffer));
  }

  @Get("export.pdf")
  async exportPdf(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
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
      ...data.findingsByUnit.flatMap((row: any) => [
        `${row.unitCode} - ${row.unitName}`,
        `  Temuan ${row.total}; terbuka ${row.open}; mayor ${row.major}; rasio ${row.findingRate}%`,
        `  CAPA efektif ${row.capaEffective}/${row.capaTotal}; terlambat ${row.capaOverdue}; progres ${row.avgProgress}%`,
      ]),
      "",
      "CAPA TERLAMBAT",
      ...(data.overdueCapa.length
        ? data.overdueCapa.flatMap((row: any) => [
            `${row.findingCode} | ${row.unitCode} | ${row.moduleCode}`,
            `  ${row.daysLate} hari terlambat; progres ${row.progressPercent}%; target ${dateText(row.targetDate)}`,
            `  ${row.correctiveAction}`,
          ])
        : ["Tidak ada CAPA terlambat pada filter yang dipilih."]),
      "",
      "RENCANA KERJA PRIORITAS",
      ...(data.workPlan.length
        ? data.workPlan.flatMap((row: any) => [
            `${row.priority} | ${row.moduleCode} | ${row.affectedUnits.join(", ")}`,
            `  Temuan ${row.findingCount}; terbuka ${row.openCount}; mayor ${row.majorCount}; terlambat ${row.overdueCount}`,
            `  Rencana: ${row.recommendedAction}`,
            `  Indikator: ${row.successIndicator}`,
          ])
        : ["Belum ada temuan untuk disusun menjadi rencana kerja."]),
    ];
    const pdf = createPdfWithPolbengLogo(lines);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="Rekap_Institusi_SAMI_NONAK.pdf"',
    );
    response.send(pdf);
  }
}
