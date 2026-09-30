import { BadRequestException, Body, Controller, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

const PROCESS_RESULTS = new Set([
  "C",
  "OBS",
  "KTS_MINOR",
  "KTS_MAYOR",
  "NA",
]);
const STANDARD_RESULTS = new Set([
  "MELAMPAUI",
  "TERCAPAI",
  "TIDAK_TERCAPAI",
  "BELUM_DIUKUR",
]);

@Controller("audit-flow")
export class WorkpaperDraftController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Post("workspaces/:id/workpapers")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async saveDraft(
    @Param("id") workspaceId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const auditQuestionId = String(body.auditQuestionId || "").trim();
    if (!auditQuestionId) {
      throw new BadRequestException("Pertanyaan audit wajib dipilih.");
    }

    const workspace = await this.flow.workspace(workspaceId, user);
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);

    const question = await this.flow.prisma.auditQuestion.findUnique({
      where: { id: auditQuestionId },
      include: {
        assessment: true,
        masterQuestion: { include: { isoClause: true } },
      },
    });
    if (!question || question.workspaceId !== workspaceId) {
      throw new BadRequestException("Pertanyaan tidak berasal dari ruang kerja ini.");
    }
    if (question.reviewStatus !== "PUBLISHED" || question.excluded) {
      throw new BadRequestException(
        "Pertanyaan belum tersedia pada instrumen yang dipublikasikan.",
      );
    }

    const isIso =
      Boolean(question.masterQuestion.isoClauseId || question.masterQuestion.isoClause) ||
      question.masterQuestion.criterionSource === "ISO_9001";
    let standardResult: any = null;
    let processResult: any = null;
    if (isIso) {
      processResult = String(
        body.processResult || question.assessment?.processResult || "",
      )
        .trim()
        .toUpperCase()
        .replace("NC_MINOR", "KTS_MINOR")
        .replace("NC_MAJOR", "KTS_MAYOR");
      if (!PROCESS_RESULTS.has(processResult)) {
        throw new BadRequestException(
          "Kategori ISO harus C, OBS, KTS/NC Minor, KTS/NC Mayor, atau NA.",
        );
      }
    } else {
      standardResult = String(
        body.standardResult || question.assessment?.standardResult || "",
      )
        .trim()
        .toUpperCase()
        .replace("BELUM_DIKERJAKAN", "BELUM_DIUKUR");
      if (!STANDARD_RESULTS.has(standardResult)) {
        throw new BadRequestException(
          "Kategori SPMI harus Melampaui, Tercapai, Tidak Tercapai, atau Belum Diukur.",
        );
      }
    }

    const objectiveEvidence = String(body.objectiveEvidence || "").trim();
    const auditorAnalysis = String(body.auditorAnalysis || "").trim();
    if (!objectiveEvidence || !auditorAnalysis) {
      throw new BadRequestException(
        "Bukti objektif dan analisis Auditor wajib diisi sebelum menyimpan draft.",
      );
    }

    const existing = await this.flow.prisma.workpaper.findUnique({
      where: {
        auditQuestionId_auditorUserId: {
          auditQuestionId,
          auditorUserId: user.id,
        },
      },
    });
    if (existing) {
      this.flow.requireStatus(existing.documentStatus, ["DRAFT", "RETURNED"]);
    }

    const auditStatus = isIso
      ? processResult
      : standardResult === "BELUM_DIUKUR"
        ? "OBS"
        : standardResult === "TIDAK_TERCAPAI"
          ? "KTS_MINOR"
          : "C";
    const data = {
      sampleDescription: String(body.sampleDescription || "").trim() || null,
      interviewee: String(body.interviewee || "").trim() || null,
      objectiveEvidence,
      auditorAnalysis,
      auditStatus,
      documentStatus: "DRAFT" as const,
      standardResult,
      processResult,
    };

    const saved = await this.flow.prisma.workpaper.upsert({
      where: {
        auditQuestionId_auditorUserId: {
          auditQuestionId,
          auditorUserId: user.id,
        },
      },
      create: {
        auditQuestionId,
        auditorUserId: user.id,
        ...data,
      },
      update: data,
    });

    await this.flow.log(
      user.id,
      user.username,
      "WORKPAPER_DRAFT_SAVED",
      "Workpaper",
      saved.id,
      workspaceId,
      {
        auditQuestionId,
        sourceType: isIso ? "ISO" : "SPMI",
        standardResult,
        processResult,
      },
    );
    return saved;
  }
}
