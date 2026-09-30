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

const STANDARD_RESULTS = [
  "MELAMPAUI",
  "TERCAPAI",
  "TIDAK_TERCAPAI",
  "BELUM_DIKERJAKAN",
  "BELUM_DIUKUR",
];
const PROCESS_RESULTS = [
  "C",
  "OFI",
  "OBS",
  "KTS_MINOR",
  "KTS_MAYOR",
  "NC_MINOR",
  "NC_MAJOR",
  "GP",
  "NA",
];

@Controller("audit-flow")
export class AssessmentWorkflowController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  private mapStandardResult(value: unknown) {
    const result = String(value ?? "").trim().toUpperCase();
    if (!STANDARD_RESULTS.includes(result)) {
      throw new BadRequestException("Hasil pencapaian standar tidak valid.");
    }
    return result === "BELUM_DIKERJAKAN" ? "BELUM_DIUKUR" : result;
  }

  private mapProcessResult(value: unknown) {
    const result = String(value ?? "").trim().toUpperCase();
    if (!PROCESS_RESULTS.includes(result)) {
      throw new BadRequestException("Hasil kesesuaian proses tidak valid.");
    }
    if (result === "NC_MINOR") return "KTS_MINOR";
    if (result === "NC_MAJOR") return "KTS_MAYOR";
    return result;
  }

  @Get("workspaces/:id/assessment-flow")
  async detail(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const [questions, evidences, schedule] = await Promise.all([
      this.flow.prisma.auditQuestion.findMany({
        where: {
          workspaceId: id,
          reviewStatus: "PUBLISHED",
          excluded: false,
        },
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
  async saveAuditeeAnswer(
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
      this.flow.requireStatus(assessment.responseStatus, ["RETURNED", "OPEN"]);
    } else {
      throw new BadRequestException(
        "Jawaban Auditee hanya dapat diperbarui pada tahap self-assessment atau perbaikan audit lapangan.",
      );
    }

    const implementationDescription = String(
      body.implementationDescription ?? body.response ?? "",
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

  @Post("workspaces/:id/assessments/submit-auditee")
  @Roles("AUDITEE")
  async submitAuditee(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new BadRequestException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(workspace.status, ["SELF_ASSESSMENT"]);
    await this.schedule.requireOpen(id, "SELF_ASSESSMENT");

    const incomplete = await this.flow.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: id, required: true, excluded: false },
        OR: [
          { implementationDescription: null },
          { implementationDescription: "" },
        ],
      },
    });
    if (incomplete) {
      throw new BadRequestException(
        `Masih ada ${incomplete} pertanyaan wajib yang belum dijawab.`,
      );
    }

    await this.flow.prisma.$transaction([
      this.flow.prisma.selfAssessment.updateMany({
        where: { question: { workspaceId: id, excluded: false } },
        data: {
          responseStatus: "SUBMITTED",
          submittedById: user.id,
          submittedAt: new Date(),
          approvedById: null,
          approvedAt: null,
          returnNote: null,
        },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "DESK_REVIEW" },
      }),
    ]);
    await this.flow.notifyRole(
      id,
      "AUDITOR",
      "SELF_ASSESSMENT_SUBMITTED",
      "Self-assessment menunggu pemeriksaan",
      `${workspace.unit.name} telah mengirim seluruh jawaban dan bukti untuk diperiksa.`,
      "AuditWorkspace",
      id,
    );
    await this.flow.notifyRole(
      id,
      "LEAD_AUDITOR",
      "SELF_ASSESSMENT_SUBMITTED",
      "Self-assessment menunggu pemeriksaan",
      `${workspace.unit.name} telah mengirim seluruh jawaban dan bukti untuk diperiksa.`,
      "AuditWorkspace",
      id,
    );
    await this.flow.log(
      user.id,
      user.username,
      "SELF_ASSESSMENT_SUBMITTED",
      "AuditWorkspace",
      id,
      id,
      { unitId: workspace.unitId },
    );
    return { ok: true, status: "DESK_REVIEW" };
  }

  @Patch("assessment-evidences/:id/review")
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
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
    await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT_REVIEW");

    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (!["VALID", "INVALID"].includes(decision)) {
      throw new BadRequestException("Pilih status bukti Valid atau Tidak Valid.");
    }
    const note = String(body.note ?? "").trim();
    if (decision === "INVALID" && !note) {
      throw new BadRequestException(
        "Catatan wajib diisi untuk bukti yang tidak valid.",
      );
    }
    const reviewStatus = decision === "VALID" ? "VALID" : "INVALID";
    const updated = await this.flow.prisma.evidence.update({
      where: { id },
      data: {
        reviewStatus,
        validationNote: note || null,
        validatedAt: new Date(),
      },
    });
    await this.flow.log(
      user.id,
      user.username,
      decision === "VALID" ? "EVIDENCE_VALIDATED" : "EVIDENCE_INVALIDATED",
      "Evidence",
      id,
      evidence.workspaceId,
      { decision, note: note || null },
    );
    return updated;
  }

  @Post("assessments/:id/auditor-review")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async reviewAssessment(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
      where: { id },
      include: {
        question: {
          include: {
            workspace: { include: { team: true } },
            evidences: { where: { deletedAt: null } },
          },
        },
      },
    });
    const workspace = assessment.question.workspace;
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
    await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT_REVIEW");
    this.flow.requireStatus(assessment.responseStatus, ["SUBMITTED"]);

    const pendingEvidence = assessment.question.evidences.filter(
      (item) => item.reviewStatus === "PENDING",
    ).length;
    if (pendingEvidence) {
      throw new BadRequestException(
        `Masih ada ${pendingEvidence} bukti terkait yang belum diperiksa.`,
      );
    }

    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (!["ACCEPT", "RETURN"].includes(decision)) {
      throw new BadRequestException("Pilih keputusan Diterima atau Dikembalikan.");
    }
    const note = String(body.note ?? "").trim();
    if (decision === "RETURN" && !note) {
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    }
    const accepted = decision === "ACCEPT";
    const updated = await this.flow.prisma.selfAssessment.update({
      where: { id },
      data: {
        responseStatus: accepted ? "APPROVED" : "RETURNED",
        approvedById: user.id,
        approvedAt: new Date(),
        returnNote: note || null,
      },
    });
    if (!accepted) {
      const auditees = await this.flow.prisma.user.findMany({
        where: {
          unitId: workspace.unitId,
          status: "ACTIVE",
          roles: { some: { role: { code: "AUDITEE" } } },
        },
        select: { id: true },
      });
      if (auditees.length) {
        await this.flow.prisma.notification.createMany({
          data: auditees.map((auditee) => ({
            workspaceId: workspace.id,
            recipientUserId: auditee.id,
            event: "SELF_ASSESSMENT_RETURNED",
            title: "Jawaban atau bukti perlu diperbaiki",
            message: note,
            entityType: "SelfAssessment",
            entityId: id,
          })),
        });
      }
    }
    await this.flow.log(
      user.id,
      user.username,
      accepted ? "SELF_ASSESSMENT_ITEM_ACCEPTED" : "SELF_ASSESSMENT_ITEM_RETURNED",
      "SelfAssessment",
      id,
      workspace.id,
      { decision, note: note || null },
    );
    return updated;
  }

  @Post("workspaces/:id/field-audit/open")
  @Roles("KETUA_AUDITOR")
  async openFieldAudit(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
    await this.schedule.requireOpen(id, "FIELD_AUDIT");

    const [unreviewedAssessments, pendingEvidence] = await Promise.all([
      this.flow.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: { notIn: ["APPROVED", "RETURNED"] },
        },
      }),
      this.flow.prisma.evidence.count({
        where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
      }),
    ]);
    if (unreviewedAssessments || pendingEvidence) {
      throw new BadRequestException(
        `Assessment lapangan belum dapat dibuka: ${unreviewedAssessments} jawaban dan ${pendingEvidence} bukti belum diperiksa.`,
      );
    }

    const updated = await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "FIELD_AUDIT" },
    });
    await this.flow.log(
      user.id,
      user.username,
      "FIELD_AUDIT_OPENED",
      "AuditWorkspace",
      id,
      id,
      { unitId: workspace.unitId },
    );
    return updated;
  }

  @Post("assessments/:id/field-decision")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async fieldDecision(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
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
    const workspace = assessment.question.workspace;
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
    await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");

    const action = String(body.action ?? "").trim().toUpperCase();
    if (!["CLOSE", "OPEN"].includes(action)) {
      throw new BadRequestException("Pilih status Selesai atau Open.");
    }
    const result =
      assessment.question.dimension === "STANDARD_ACHIEVEMENT"
        ? this.mapStandardResult(body.standardResult)
        : this.mapProcessResult(body.processResult);
    const note = String(body.note ?? "").trim();
    if (!note) {
      throw new BadRequestException("Catatan hasil assessment lapangan wajib diisi.");
    }

    if (action === "CLOSE") {
      await this.flow.prisma.$transaction([
        this.flow.prisma.selfAssessment.update({
          where: { id },
          data: {
            responseStatus: "APPROVED",
            standardResult:
              assessment.question.dimension === "STANDARD_ACHIEVEMENT"
                ? (result as any)
                : null,
            processResult:
              assessment.question.dimension === "PROCESS_CONFORMITY"
                ? (result as any)
                : null,
            approvedById: user.id,
            approvedAt: new Date(),
            returnNote: note,
            score: null,
          },
        }),
        this.flow.prisma.finding.updateMany({
          where: {
            workspaceId: workspace.id,
            auditQuestionId: assessment.auditQuestionId,
            status: "OPEN",
          },
          data: { status: "CLOSED" },
        }),
      ]);
      await this.flow.log(
        user.id,
        user.username,
        "FIELD_ASSESSMENT_ITEM_CLOSED",
        "SelfAssessment",
        id,
        workspace.id,
        { result, note },
      );
      return { ok: true, status: "APPROVED", result };
    }

    const dueDate = new Date(body.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException("Batas waktu perbaikan wajib diisi.");
    }
    const count = await this.flow.prisma.finding.count({
      where: { workspaceId: workspace.id },
    });
    const findingType =
      body.findingType === "NC_MINOR"
        ? "KTS_MINOR"
        : body.findingType === "NC_MAJOR"
          ? "KTS_MAYOR"
          : body.findingType || "KTS_MINOR";
    const existing = assessment.question.findings.find(
      (item) => item.status === "OPEN",
    );

    const findingData = {
      findingType: findingType as any,
      criteriaRegulation:
        body.criteriaRegulation ||
        assessment.question.masterQuestion.standard?.title ||
        "Standar internal",
      criteriaIso:
        body.criteriaIso ||
        assessment.question.masterQuestion.isoClause?.code ||
        "—",
      condition: body.condition || note,
      objectiveEvidence: body.objectiveEvidence || note,
      gapStatement: body.gapStatement || note,
      riskImpact: body.riskImpact || "Perlu perbaikan sesuai batas waktu.",
      dueDate,
      status: "OPEN" as const,
    };

    await this.flow.prisma.$transaction([
      this.flow.prisma.selfAssessment.update({
        where: { id },
        data: {
          responseStatus: "OPEN",
          standardResult:
            assessment.question.dimension === "STANDARD_ACHIEVEMENT"
              ? (result as any)
              : null,
          processResult:
            assessment.question.dimension === "PROCESS_CONFORMITY"
              ? (result as any)
              : null,
          approvedById: user.id,
          approvedAt: new Date(),
          returnNote: note,
          score: null,
        },
      }),
      existing
        ? this.flow.prisma.finding.update({
            where: { id: existing.id },
            data: findingData,
          })
        : this.flow.prisma.finding.create({
            data: {
              ...findingData,
              code: `FND-${workspace.auditYear}-${String(count + 1).padStart(5, "0")}`,
              workspaceId: workspace.id,
              auditQuestionId: assessment.auditQuestionId,
            },
          }),
    ]);
    await this.flow.log(
      user.id,
      user.username,
      "FIELD_ASSESSMENT_ITEM_OPENED",
      "SelfAssessment",
      id,
      workspace.id,
      { result, note, dueDate },
    );
    return { ok: true, status: "OPEN", result, dueDate };
  }

  @Post("workspaces/:id/field-audit/complete")
  @Roles("KETUA_AUDITOR")
  async completeFieldAudit(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
    const unresolved = await this.flow.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: id, excluded: false },
        responseStatus: { notIn: ["APPROVED", "OPEN"] },
      },
    });
    if (unresolved) {
      throw new BadRequestException(
        `Masih ada ${unresolved} butir yang belum diputuskan pada assessment lapangan.`,
      );
    }
    const openQuestions = await this.flow.prisma.selfAssessment.count({
      where: { question: { workspaceId: id }, responseStatus: "OPEN" },
    });
    const updated = await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "REPORTING" },
    });
    await this.flow.log(
      user.id,
      user.username,
      "FIELD_AUDIT_COMPLETED",
      "AuditWorkspace",
      id,
      id,
      { openQuestions },
    );
    return updated;
  }

  @Post("workspaces/:id/assessment-evidences/upload")
  @Roles("AUDITEE")
  @UseInterceptors(FileInterceptor("file"))
  async uploadAssessmentEvidence(
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
    if (workspace.status === "SELF_ASSESSMENT") {
      await this.schedule.requireOpen(id, "SELF_ASSESSMENT");
    } else if (workspace.status === "FIELD_AUDIT") {
      await this.schedule.requireOpen(id, "FIELD_AUDIT");
      if (body.auditQuestionId) {
        const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
          where: { id: body.auditQuestionId },
          include: { assessment: true },
        });
        if (
          question.workspaceId !== id ||
          !["RETURNED", "OPEN", "IN_PROGRESS"].includes(
            question.assessment?.responseStatus || "",
          )
        ) {
          throw new BadRequestException(
            "Bukti perbaikan hanya dapat diunggah untuk butir yang dikembalikan atau berstatus Open.",
          );
        }
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
    const safeName = `${Date.now()}-${String(file.originalname).replace(/[^\w.-]/g, "_")}`;
    await writeFile(join(directory, safeName), file.buffer);
    const count = await this.flow.prisma.evidence.count();
    const evidence = await this.flow.prisma.evidence.create({
      data: {
        code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
        workspaceId: id,
        auditQuestionId: body.auditQuestionId || null,
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
      { auditQuestionId: body.auditQuestionId || null, fileName: file.originalname },
    );
    return evidence;
  }
}
