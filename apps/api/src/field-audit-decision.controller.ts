import { BadRequestException, Body, Controller, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

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

@Controller("audit-flow")
export class FieldAuditDecisionController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  @Post("assessments/:id/field-decision")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async decide(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
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
      throw new BadRequestException("Butir assessment tidak ditemukan.");
    }

    const workspace = assessment.question.workspace;
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
    await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");

    const master = assessment.question.masterQuestion;
    const isIso =
      Boolean(master.isoClauseId || master.isoClause) ||
      master.criterionSource === "ISO_9001";
    const note = String(body.note || "").trim();
    if (!note) {
      throw new BadRequestException("Catatan hasil assessment lapangan wajib diisi.");
    }

    let standardResult: any = null;
    let processResult: any = null;
    if (isIso) {
      processResult = String(body.processResult || "")
        .trim()
        .toUpperCase()
        .replace("NC_MINOR", "KTS_MINOR")
        .replace("NC_MAJOR", "KTS_MAYOR");
      if (!PROCESS_RESULTS.has(processResult)) {
        throw new BadRequestException(
          "Butir ISO hanya dapat dinilai C, OBS, KTS/NC Minor, KTS/NC Mayor, atau NA.",
        );
      }
    } else {
      standardResult = String(body.standardResult || "")
        .trim()
        .toUpperCase()
        .replace("BELUM_DIKERJAKAN", "BELUM_DIUKUR");
      if (!STANDARD_RESULTS.has(standardResult)) {
        throw new BadRequestException(
          "Butir SPMI hanya dapat dinilai Melampaui, Tercapai, Tidak Tercapai, atau Belum Diukur.",
        );
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
      throw new BadRequestException(
        "Bukti objektif dan analisis Auditor wajib diisi sebagai kertas kerja assessment lapangan.",
      );
    }

    const existingWorkpaper = await this.flow.prisma.workpaper.findUnique({
      where: {
        auditQuestionId_auditorUserId: {
          auditQuestionId: assessment.auditQuestionId,
          auditorUserId: user.id,
        },
      },
    });
    if (
      existingWorkpaper &&
      !["DRAFT", "RETURNED"].includes(existingWorkpaper.documentStatus)
    ) {
      throw new BadRequestException(
        "Kertas kerja telah diajukan atau disetujui dan tidak dapat diubah.",
      );
    }

    let dueDate: Date | null = null;
    let findingType: any = null;
    let findingData: any = null;
    if (requiresFinding) {
      dueDate = new Date(String(body.dueDate || ""));
      if (Number.isNaN(dueDate.getTime())) {
        throw new BadRequestException(
          "Kategori ini otomatis menjadi temuan. Batas waktu perbaikan wajib diisi.",
        );
      }

      const requestedFindingType = String(
        body.findingType ||
          (standardResult === "BELUM_DIUKUR" || processResult === "NA"
            ? "OBS"
            : "KTS_MINOR"),
      )
        .trim()
        .toUpperCase()
        .replace("NC_MINOR", "KTS_MINOR")
        .replace("NC_MAJOR", "KTS_MAYOR");

      findingType =
        isIso && processResult !== "NA" ? processResult : requestedFindingType;
      if (!FINDING_TYPES.has(findingType)) {
        throw new BadRequestException(
          "Klasifikasi temuan harus OBS, KTS/NC Minor, atau KTS/NC Mayor.",
        );
      }

      const condition = String(body.condition || note).trim();
      const gapStatement = String(body.gapStatement || note).trim();
      const riskImpact = String(
        body.riskImpact || "Perlu perbaikan sesuai batas waktu.",
      ).trim();
      if (!condition || !gapStatement || !riskImpact) {
        throw new BadRequestException(
          "Kondisi, kesenjangan, dan dampak risiko wajib diisi untuk temuan audit.",
        );
      }

      findingData = {
        findingType,
        criteriaRegulation:
          String(body.criteriaRegulation || "").trim() ||
          master.standard?.title ||
          "Standar SPMI/Internal",
        criteriaIso:
          String(body.criteriaIso || "").trim() || master.isoClause?.code || "—",
        condition,
        objectiveEvidence,
        gapStatement,
        riskImpact,
        dueDate,
        status: "OPEN",
      };
    }

    const existingFinding = assessment.question.findings.find(
      (item) => item.status === "OPEN",
    );
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
        } else {
          await transaction.finding.create({
            data: {
              ...findingData,
              code: `FND-${workspace.auditYear}-${String(findingCount + 1).padStart(5, "0")}`,
              workspaceId: workspace.id,
              auditQuestionId: assessment.auditQuestionId,
            },
          });
        }
      } else {
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
}
