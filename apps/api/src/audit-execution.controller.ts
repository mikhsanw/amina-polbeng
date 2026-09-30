import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow")
export class AuditExecutionController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Patch("assessments/:id")
  @Roles("AUDITEE")
  async editAssessment(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
      where: { id },
      include: { question: { include: { workspace: true } } },
    });
    if (assessment.question.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(assessment.responseStatus, [
      "NOT_STARTED",
      "IN_PROGRESS",
      "RETURNED",
      "DRAFT",
    ]);
    const dimension = assessment.question.dimension;
    if (dimension === "STANDARD_ACHIEVEMENT" && !body.standardResult) {
      throw new BadRequestException("Hasil capaian standar wajib dipilih.");
    }
    if (dimension === "PROCESS_CONFORMITY" && !body.processResult) {
      throw new BadRequestException("Hasil kesesuaian proses wajib dipilih.");
    }
    return this.flow.prisma.selfAssessment.update({
      where: { id },
      data: {
        response: body.implementationDescription ?? body.response,
        implementationDescription:
          body.implementationDescription ?? body.response,
        evidenceSummary: body.evidenceSummary,
        constraintNote: body.constraintNote,
        score:
          body.score === "" || body.score == null ? null : Number(body.score),
        standardResult:
          dimension === "STANDARD_ACHIEVEMENT" ? body.standardResult : null,
        processResult:
          dimension === "PROCESS_CONFORMITY" ? body.processResult : null,
        responseStatus: "IN_PROGRESS",
      },
    });
  }

  @Delete("assessments/:id")
  @Roles("AUDITEE")
  async clearAssessment(@Param("id") id: string, @CurrentUser() user: any) {
    const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
      where: { id },
      include: { question: { include: { workspace: true } } },
    });
    if (assessment.question.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(assessment.responseStatus, [
      "NOT_STARTED",
      "IN_PROGRESS",
      "RETURNED",
      "DRAFT",
    ]);
    return this.flow.prisma.selfAssessment.update({
      where: { id },
      data: {
        response: null,
        implementationDescription: null,
        evidenceSummary: null,
        constraintNote: null,
        score: null,
        standardResult: null,
        processResult: null,
        responseStatus: "NOT_STARTED",
      },
    });
  }

  @Post("workspaces/:id/assessments/submit")
  @Roles("AUDITEE")
  async submitAssessments(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    const incomplete = await this.flow.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: id, required: true, excluded: false },
        OR: [
          { implementationDescription: null },
          { implementationDescription: "" },
          {
            question: { dimension: "STANDARD_ACHIEVEMENT" },
            standardResult: null,
          },
          {
            question: { dimension: "PROCESS_CONFORMITY" },
            processResult: null,
          },
        ],
      },
    });
    if (incomplete) {
      throw new BadRequestException(
        `Masih ada ${incomplete} pertanyaan wajib yang belum lengkap.`,
      );
    }
    const status = user.isUnitApprover ? "APPROVED" : "SUBMITTED";
    await this.flow.prisma.selfAssessment.updateMany({
      where: { question: { workspaceId: id, excluded: false } },
      data: {
        responseStatus: status,
        submittedById: user.id,
        submittedAt: new Date(),
        approvedById: user.isUnitApprover ? user.id : null,
        approvedAt: user.isUnitApprover ? new Date() : null,
      },
    });
    if (user.isUnitApprover) {
      await this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "DESK_REVIEW" },
      });
      await this.flow.notifyRole(
        id,
        "LEAD_AUDITOR",
        "SELF_ASSESSMENT_APPROVED",
        "Penilaian mandiri disahkan",
        "Penilaian mandiri unit telah siap untuk desk review.",
        "AuditWorkspace",
        id,
      );
    }
    return { ok: true, status };
  }

  @Post("workspaces/:id/assessments/approve")
  @Roles("AUDITEE")
  async approveAssessments(@Param("id") id: string, @CurrentUser() user: any) {
    if (!user.isUnitApprover) {
      throw new ForbiddenException("Akun Auditee ini bukan pengesah unit.");
    }
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    const pending = await this.flow.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: id, excluded: false },
        responseStatus: { not: "SUBMITTED" },
      },
    });
    if (pending)
      throw new BadRequestException("Seluruh jawaban harus SUBMITTED.");
    await this.flow.prisma.$transaction([
      this.flow.prisma.selfAssessment.updateMany({
        where: { question: { workspaceId: id, excluded: false } },
        data: {
          responseStatus: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
        },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "DESK_REVIEW" },
      }),
    ]);
    return { ok: true };
  }

  @Post("workspaces/:id/assessments/return")
  @Roles("AUDITEE")
  async returnAssessments(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!user.isUnitApprover) {
      throw new ForbiddenException("Akun Auditee ini bukan pengesah unit.");
    }
    if (!body.note)
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    await this.flow.prisma.selfAssessment.updateMany({
      where: { question: { workspaceId: id, excluded: false } },
      data: { responseStatus: "RETURNED", returnNote: body.note },
    });
    return { ok: true };
  }

  private async saveEvidence(
    workspaceId: string,
    user: any,
    metadata: any,
    bytes: Buffer,
    originalName: string,
    mimeType: string,
  ) {
    const workspace = await this.flow.workspace(workspaceId, user);
    if (workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
    if (!bytes.length || bytes.length > maxBytes) {
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
    const safeName = `${Date.now()}-${originalName.replace(/[^\w.-]/g, "_")}`;
    await writeFile(join(directory, safeName), bytes);
    const count = await this.flow.prisma.evidence.count();
    return this.flow.prisma.evidence.create({
      data: {
        code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
        workspaceId,
        auditQuestionId: metadata.auditQuestionId || null,
        evidenceType: metadata.evidenceType || "OTHER",
        title: metadata.title || originalName,
        description: metadata.description || null,
        fileName: originalName,
        mimeType: mimeType || "application/octet-stream",
        fileSizeBytes: bytes.length,
        storageKey: join(
          "storage",
          "audits",
          String(workspace.auditYear),
          workspace.name,
          "evidence",
          safeName,
        ),
        checksum: createHash("sha256").update(bytes).digest("hex"),
        uploadedById: user.id,
        confidentiality: metadata.confidentiality || "INTERNAL",
      },
    });
  }

  @Post("workspaces/:id/evidences/upload")
  @Roles("AUDITEE")
  @UseInterceptors(FileInterceptor("file"))
  uploadEvidence(
    @Param("id") id: string,
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException("File wajib dipilih.");
    return this.saveEvidence(
      id,
      user,
      body,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post("workspaces/:id/evidences")
  @Roles("AUDITEE")
  uploadEvidenceLegacy(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!body.fileBase64 || !body.fileName) {
      throw new BadRequestException("File wajib dipilih.");
    }
    const bytes = Buffer.from(
      String(body.fileBase64).replace(/^data:.*;base64,/, ""),
      "base64",
    );
    return this.saveEvidence(
      id,
      user,
      body,
      bytes,
      body.fileName,
      body.mimeType,
    );
  }

  @Patch("evidences/:id")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async reviewEvidence(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const evidence = await this.flow.prisma.evidence.findUniqueOrThrow({
      where: { id },
    });
    const workspace = await this.flow.workspace(evidence.workspaceId, user);
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    return this.flow.prisma.evidence.update({
      where: { id },
      data: {
        reviewStatus: body.reviewStatus,
        validationNote: body.validationNote,
        validatedAt: new Date(),
      },
    });
  }

  @Delete("evidences/:id")
  @Roles("AUDITEE")
  async deleteEvidence(@Param("id") id: string, @CurrentUser() user: any) {
    const evidence = await this.flow.prisma.evidence.findUniqueOrThrow({
      where: { id },
    });
    if (evidence.uploadedById !== user.id) {
      throw new ForbiddenException(
        "Bukti hanya dapat dihapus oleh pengunggah.",
      );
    }
    if (evidence.reviewStatus === "VALID") {
      throw new BadRequestException("Bukti VALID telah dikunci.");
    }
    const target = resolve(process.cwd(), evidence.storageKey);
    const root = resolve(process.cwd(), "storage");
    if (target.startsWith(root)) await unlink(target).catch(() => undefined);
    await this.flow.prisma.evidence.delete({ where: { id } });
    return { ok: true };
  }

  @Post("workspaces/:id/workpapers")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async saveWorkpaper(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id: body.auditQuestionId },
    });
    if (question.workspaceId !== id || question.reviewStatus !== "PUBLISHED") {
      throw new BadRequestException(
        "Pertanyaan tidak tersedia pada instrumen terbit.",
      );
    }
    const existing = await this.flow.prisma.workpaper.findUnique({
      where: {
        auditQuestionId_auditorUserId: {
          auditQuestionId: body.auditQuestionId,
          auditorUserId: user.id,
        },
      },
    });
    if (existing) {
      this.flow.requireStatus(existing.documentStatus, ["DRAFT", "RETURNED"]);
    }
    const processResult =
      question.dimension === "PROCESS_CONFORMITY" ? body.processResult : null;
    const standardResult =
      question.dimension === "STANDARD_ACHIEVEMENT"
        ? body.standardResult
        : null;
    const auditStatus = processResult ?? "C";
    return this.flow.prisma.workpaper.upsert({
      where: {
        auditQuestionId_auditorUserId: {
          auditQuestionId: body.auditQuestionId,
          auditorUserId: user.id,
        },
      },
      create: {
        auditQuestionId: body.auditQuestionId,
        auditorUserId: user.id,
        sampleDescription: body.sampleDescription,
        interviewee: body.interviewee,
        objectiveEvidence: body.objectiveEvidence,
        auditorAnalysis: body.auditorAnalysis,
        auditStatus,
        documentStatus: "DRAFT",
        standardResult,
        processResult,
      },
      update: {
        sampleDescription: body.sampleDescription,
        interviewee: body.interviewee,
        objectiveEvidence: body.objectiveEvidence,
        auditorAnalysis: body.auditorAnalysis,
        auditStatus,
        standardResult,
        processResult,
        documentStatus: "DRAFT",
      },
    });
  }

  @Post("workpapers/:id/submit")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async submitWorkpaper(@Param("id") id: string, @CurrentUser() user: any) {
    const workpaper = await this.flow.prisma.workpaper.findUniqueOrThrow({
      where: { id },
      include: {
        question: { include: { workspace: { include: { team: true } } } },
      },
    });
    if (workpaper.auditorUserId !== user.id) {
      throw new ForbiddenException("Kertas kerja bukan milik auditor ini.");
    }
    this.flow.requireStatus(workpaper.documentStatus, ["DRAFT", "RETURNED"]);
    return this.flow.prisma.workpaper.update({
      where: { id },
      data: { documentStatus: "SUBMITTED", submittedAt: new Date() },
    });
  }

  @Post("workpapers/:id/approve")
  @Roles("KETUA_AUDITOR")
  async approveWorkpaper(@Param("id") id: string, @CurrentUser() user: any) {
    const workpaper = await this.flow.prisma.workpaper.findUniqueOrThrow({
      where: { id },
      include: {
        question: { include: { workspace: { include: { team: true } } } },
      },
    });
    this.flow.requireAssignment(workpaper.question.workspace, user, [
      "LEAD_AUDITOR",
    ]);
    this.flow.requireStatus(workpaper.documentStatus, ["SUBMITTED"]);
    return this.flow.prisma.workpaper.update({
      where: { id },
      data: {
        documentStatus: "APPROVED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        lockedAt: new Date(),
      },
    });
  }

  @Post("workpapers/:id/return")
  @Roles("KETUA_AUDITOR")
  async returnWorkpaper(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!body.note)
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    const workpaper = await this.flow.prisma.workpaper.findUniqueOrThrow({
      where: { id },
      include: {
        question: { include: { workspace: { include: { team: true } } } },
      },
    });
    this.flow.requireAssignment(workpaper.question.workspace, user, [
      "LEAD_AUDITOR",
    ]);
    this.flow.requireStatus(workpaper.documentStatus, ["SUBMITTED"]);
    return this.flow.prisma.workpaper.update({
      where: { id },
      data: {
        documentStatus: "RETURNED",
        reviewNote: body.note,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  @Post("workspaces/:id/findings")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async createFinding(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    if (body.auditQuestionId) {
      const approved = await this.flow.prisma.workpaper.count({
        where: {
          auditQuestionId: body.auditQuestionId,
          documentStatus: "APPROVED",
        },
      });
      if (!approved) {
        throw new BadRequestException(
          "Temuan hanya dapat dibuat dari kertas kerja yang telah disetujui.",
        );
      }
    }
    const count = await this.flow.prisma.finding.count({
      where: { workspaceId: id },
    });
    const findingType =
      body.findingType === "NC_MINOR"
        ? "KTS_MINOR"
        : body.findingType === "NC_MAJOR"
          ? "KTS_MAYOR"
          : body.findingType;
    return this.flow.prisma.finding.create({
      data: {
        ...body,
        findingType,
        workspaceId: id,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        code: `FND-${workspace.auditYear}-${String(count + 1).padStart(5, "0")}`,
        status: "DRAFT",
      },
    });
  }

  @Post("findings/:id/open")
  @Roles("KETUA_AUDITOR")
  async openFinding(@Param("id") id: string, @CurrentUser() user: any) {
    const finding = await this.flow.prisma.finding.findUniqueOrThrow({
      where: { id },
    });
    const workspace = await this.flow.workspace(finding.workspaceId, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(finding.status, ["DRAFT", "REVIEW"]);
    const [opened] = await this.flow.prisma.$transaction([
      this.flow.prisma.finding.update({
        where: { id },
        data: { status: "OPEN" },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id: finding.workspaceId },
        data: { status: "FOLLOW_UP" },
      }),
    ]);
    return opened;
  }
}
