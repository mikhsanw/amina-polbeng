import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

@Controller("audit-flow")
export class AuditeeAssessmentController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  @Get("workspaces/:id/assessment-flow")
  async detail(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const published = await this.flow.prisma.auditQuestion.findMany({
      where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
      select: { id: true },
    });
    if (published.length) {
      await this.flow.prisma.selfAssessment.createMany({
        data: published.map((question) => ({
          auditQuestionId: question.id,
          responseStatus: "NOT_STARTED",
        })),
        skipDuplicates: true,
      });
    }
    const [questions, evidences, schedule] = await Promise.all([
      this.flow.prisma.auditQuestion.findMany({
        where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
        include: {
          assessment: true,
          masterQuestion: { include: { standard: true, isoClause: true } },
          evidences: {
            where: { deletedAt: null },
            orderBy: { uploadedAt: "desc" },
          },
          findings: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { sortOrder: "asc" },
      }),
      this.flow.prisma.evidence.findMany({
        where: { workspaceId: id, deletedAt: null },
        include: {
          auditQuestion: { select: { id: true, sortOrder: true } },
          uploadedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { uploadedAt: "desc" },
      }),
      this.schedule.detail(id),
    ]);
    return { workspace, questions, evidences, schedule };
  }

  @Patch("assessments/:id/auditee")
  @Roles("AUDITEE")
  async saveAnswer(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
      where: { id },
      include: { question: { include: { workspace: true } } },
    });
    const workspace = assessment.question.workspace;
    if (workspace.unitId !== user.unitId) {
      throw new BadRequestException("Bukan Auditee unit target.");
    }
    if (workspace.status === "SELF_ASSESSMENT") {
      await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT");
      this.flow.requireStatus(assessment.responseStatus, [
        "NOT_STARTED",
        "IN_PROGRESS",
        "RETURNED",
      ]);
    } else if (workspace.status === "FIELD_AUDIT") {
      await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");
      this.flow.requireStatus(assessment.responseStatus, [
        "RETURNED",
        "OPEN",
        "IN_PROGRESS",
      ]);
    } else {
      throw new BadRequestException(
        "Jawaban tidak dapat diubah pada tahap audit saat ini.",
      );
    }
    const implementationDescription = String(
      body.implementationDescription ?? "",
    ).trim();
    const updated = await this.flow.prisma.selfAssessment.update({
      where: { id },
      data: {
        response: implementationDescription || null,
        implementationDescription: implementationDescription || null,
        evidenceSummary: String(body.evidenceSummary ?? "").trim() || null,
        constraintNote: String(body.constraintNote ?? "").trim() || null,
        responseStatus: "IN_PROGRESS",
        score: null,
        standardResult: null,
        processResult: null,
      },
    });
    await this.flow.log(
      user.id,
      user.username,
      "SELF_ASSESSMENT_ANSWER_SAVED",
      "SelfAssessment",
      id,
      workspace.id,
      { auditQuestionId: assessment.auditQuestionId },
    );
    return updated;
  }

  @Post("workspaces/:id/assessment-evidences/upload")
  @Roles("AUDITEE")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Param("id") id: string,
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException("File bukti wajib dipilih.");
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new BadRequestException("Bukan Auditee unit target.");
    }
    const auditQuestionId = String(body.auditQuestionId ?? "").trim();
    if (!auditQuestionId) {
      throw new BadRequestException("Pertanyaan audit untuk bukti wajib dipilih.");
    }
    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id: auditQuestionId },
      include: { assessment: true },
    });
    if (question.workspaceId !== id || question.excluded) {
      throw new BadRequestException(
        "Pertanyaan bukti tidak berasal dari workspace ini.",
      );
    }
    if (workspace.status === "SELF_ASSESSMENT") {
      await this.schedule.requireOpen(id, "SELF_ASSESSMENT");
    } else if (workspace.status === "FIELD_AUDIT") {
      await this.schedule.requireOpen(id, "FIELD_AUDIT");
      if (
        !["RETURNED", "OPEN", "IN_PROGRESS"].includes(
          question.assessment?.responseStatus || "",
        )
      ) {
        throw new BadRequestException(
          "Bukti perbaikan hanya dapat diunggah untuk butir yang dikembalikan atau Open.",
        );
      }
    } else {
      throw new BadRequestException(
        "Unggah bukti tidak tersedia pada tahap audit saat ini.",
      );
    }
    const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
    if (!file.buffer?.length || file.buffer.length > maxBytes) {
      throw new BadRequestException(
        `Ukuran file maksimal ${process.env.MAX_UPLOAD_MB ?? 20} MB.`,
      );
    }
    const directory = join(
      process.cwd(),
      "storage",
      "audits",
      String(workspace.auditYear),
      workspace.name,
      "evidence",
    );
    await mkdir(directory, { recursive: true });
    const safeName = `${Date.now()}-${String(file.originalname).replace(
      /[^\w.-]/g,
      "_",
    )}`;
    await writeFile(join(directory, safeName), file.buffer);
    const count = await this.flow.prisma.evidence.count();
    const evidence = await this.flow.prisma.evidence.create({
      data: {
        code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
        workspaceId: id,
        auditQuestionId,
        evidenceType: body.evidenceType || "OTHER",
        title: body.title || file.originalname,
        description: body.description || null,
        fileName: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
        fileSizeBytes: file.buffer.length,
        storageKey: join(
          "storage",
          "audits",
          String(workspace.auditYear),
          workspace.name,
          "evidence",
          safeName,
        ),
        checksum: createHash("sha256").update(file.buffer).digest("hex"),
        uploadedById: user.id,
        confidentiality: body.confidentiality || "INTERNAL",
      },
    });
    await this.flow.log(
      user.id,
      user.username,
      "ASSESSMENT_EVIDENCE_UPLOADED",
      "Evidence",
      evidence.id,
      id,
      { auditQuestionId, fileName: file.originalname },
    );
    return evidence;
  }
}
