import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

function parseRequiredDate(value: unknown, label: string) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} wajib diisi dan harus valid.`);
  }
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

@Controller("audit-flow")
export class WorkflowIntegrityController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  private async plan(workspaceId: string) {
    const plan = await this.flow.prisma.auditUnitPlan.findUnique({
      where: { workspaceId },
    });
    if (!plan) {
      throw new BadRequestException("Rencana audit unit tidak ditemukan.");
    }
    const program = await this.flow.prisma.auditProgram.findUniqueOrThrow({
      where: { id: plan.programId },
    });
    return { plan, program };
  }

  private async notifyAdmins(
    workspaceId: string,
    title: string,
    message: string,
  ) {
    const admins = await this.flow.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "ADMIN_MUTU" } } },
      },
      select: { id: true },
    });
    if (!admins.length) return;
    await this.flow.prisma.notification.createMany({
      data: admins.map((admin) => ({
        workspaceId,
        recipientUserId: admin.id,
        event: "SELF_ASSESSMENT_APPROVED",
        title,
        message,
        entityType: "AuditWorkspace",
        entityId: workspaceId,
      })),
    });
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
    if (!['VALID', 'INVALID'].includes(decision)) {
      throw new BadRequestException("Pilih status bukti Valid atau Tidak Valid.");
    }
    const note = String(body.note ?? "").trim();
    if (decision === "INVALID" && !note) {
      throw new BadRequestException(
        "Catatan wajib diisi untuk bukti yang tidak valid.",
      );
    }

    const updated = await this.flow.prisma.evidence.update({
      where: { id },
      data: {
        reviewStatus: decision as any,
        validationNote: note || (decision === "VALID" ? "Bukti sesuai." : null),
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
      {
        decision,
        note: note || null,
        reassessed: evidence.reviewStatus !== "PENDING",
      },
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

    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (!['ACCEPT', 'RETURN'].includes(decision)) {
      throw new BadRequestException("Pilih keputusan Diterima atau Dikembalikan.");
    }
    const note = String(body.note ?? "").trim();
    if (decision === "RETURN" && !note) {
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    }

    const pendingEvidence = assessment.question.evidences.filter(
      (item) => item.reviewStatus === "PENDING",
    ).length;
    const invalidEvidence = assessment.question.evidences.filter(
      (item) => item.reviewStatus === "INVALID",
    ).length;
    if (pendingEvidence) {
      throw new BadRequestException(
        `Masih ada ${pendingEvidence} bukti terkait yang belum diperiksa.`,
      );
    }
    if (decision === "ACCEPT" && invalidEvidence) {
      throw new BadRequestException(
        `Masih ada ${invalidEvidence} bukti tidak valid. Nilai ulang bukti atau kembalikan butir kepada Auditee.`,
      );
    }

    const accepted = decision === "ACCEPT";
    const updated = await this.flow.prisma.selfAssessment.update({
      where: { id },
      data: {
        responseStatus: accepted ? "DESK_ACCEPTED" : "RETURNED",
        approvedById: user.id,
        approvedAt: new Date(),
        returnNote: note || null,
      },
    });

    if (!accepted) {
      await this.flow.prisma.auditWorkspace.update({
        where: { id: workspace.id },
        data: { status: "SELF_ASSESSMENT" },
      });
      const auditees = await this.flow.prisma.user.findMany({
        where: {
          unitId: workspace.unitId,
          status: "ACTIVE",
          deletedAt: null,
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
      accepted
        ? "SELF_ASSESSMENT_DESK_ACCEPTED"
        : "SELF_ASSESSMENT_ITEM_RETURNED",
      "SelfAssessment",
      id,
      workspace.id,
      { decision, note: note || null },
    );
    return updated;
  }

  @Post("workspaces/:id/assessments/submit-auditee")
  @Roles("AUDITEE")
  async resubmitAuditee(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new BadRequestException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(workspace.status, ["SELF_ASSESSMENT"]);
    await this.schedule.requireOpen(id, "SELF_ASSESSMENT");

    const incomplete = await this.flow.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: id, excluded: false, required: true },
        responseStatus: { in: ["NOT_STARTED", "IN_PROGRESS", "RETURNED"] },
        OR: [
          { implementationDescription: null },
          { implementationDescription: "" },
        ],
      },
    });
    if (incomplete) {
      throw new BadRequestException(
        `Masih ada ${incomplete} pertanyaan wajib yang belum lengkap.`,
      );
    }

    await this.flow.prisma.$transaction([
      this.flow.prisma.selfAssessment.updateMany({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: { in: ["NOT_STARTED", "IN_PROGRESS", "RETURNED"] },
        },
        data: {
          responseStatus: "SUBMITTED",
          submittedById: user.id,
          submittedAt: new Date(),
          approvedById: null,
          approvedAt: null,
        },
      }),
      this.flow.prisma.evidence.updateMany({
        where: {
          workspaceId: id,
          deletedAt: null,
          reviewStatus: "INVALID",
        },
        data: {
          reviewStatus: "PENDING",
          validationNote: null,
          validatedAt: null,
        },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "DESK_REVIEW" },
      }),
    ]);

    for (const role of ["AUDITOR", "LEAD_AUDITOR"]) {
      await this.flow.notifyRole(
        id,
        role,
        "SELF_ASSESSMENT_SUBMITTED",
        "Perbaikan self-assessment dikirim ulang",
        `${workspace.unit.name} telah mengirim ulang jawaban dan bukti untuk diperiksa.`,
        "AuditWorkspace",
        id,
      );
    }
    return { ok: true, status: "DESK_REVIEW" };
  }

  private async submitDeskReviewInternal(id: string, user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);

    const [unresolved, pendingEvidence, invalidEvidence] = await Promise.all([
      this.flow.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: { not: "DESK_ACCEPTED" },
        },
      }),
      this.flow.prisma.evidence.count({
        where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
      }),
      this.flow.prisma.evidence.count({
        where: { workspaceId: id, deletedAt: null, reviewStatus: "INVALID" },
      }),
    ]);
    if (unresolved || pendingEvidence || invalidEvidence) {
      throw new BadRequestException(
        `Review belum lengkap: ${unresolved} butir belum diterima, ${pendingEvidence} bukti belum diperiksa, dan ${invalidEvidence} bukti masih tidak valid.`,
      );
    }

    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "AUDIT" },
    });
    await this.notifyAdmins(
      id,
      "Review Auditor menunggu keputusan Admin Mutu",
      `${workspace.unit.name}: seluruh jawaban dan bukti telah diterima Auditor.`,
    );
    return { ok: true, status: "AUDIT" };
  }

  @Post("workspaces/:id/desk-review/submit")
  @Roles("KETUA_AUDITOR")
  submitDeskReview(@Param("id") id: string, @CurrentUser() user: any) {
    return this.submitDeskReviewInternal(id, user);
  }

  @Post("workspaces/:id/field-audit/open")
  @Roles("KETUA_AUDITOR")
  submitDeskReviewLegacy(@Param("id") id: string, @CurrentUser() user: any) {
    return this.submitDeskReviewInternal(id, user);
  }

  @Post("workspaces/:id/desk-review/approve")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async approveDeskReview(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.status, ["AUDIT"]);
    const { plan, program } = await this.plan(id);

    const fieldAuditEnd = parseRequiredDate(
      body.fieldAuditEnd,
      "Batas akhir assessment lapangan",
    );
    const reportingEnd = parseRequiredDate(
      body.reportingEnd,
      "Batas akhir penyusunan laporan",
    );
    const followUpEnd = parseRequiredDate(
      body.followUpEnd,
      "Batas akhir CAPA/tindak lanjut",
    );
    const ordered = [fieldAuditEnd, reportingEnd, followUpEnd].map(endOfDay);
    if (
      ordered[1].getTime() < ordered[0].getTime() ||
      ordered[2].getTime() < ordered[1].getTime()
    ) {
      throw new BadRequestException("Urutan batas akhir tahapan tidak valid.");
    }
    const start = new Date(program.startDate);
    const end = endOfDay(program.endDate);
    if (
      ordered.some(
        (deadline) =>
          deadline.getTime() < start.getTime() ||
          deadline.getTime() > end.getTime(),
      )
    ) {
      throw new BadRequestException(
        "Seluruh batas akhir harus berada dalam rentang program audit.",
      );
    }

    const [unresolved, invalidEvidence] = await Promise.all([
      this.flow.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: { not: "DESK_ACCEPTED" },
        },
      }),
      this.flow.prisma.evidence.count({
        where: {
          workspaceId: id,
          deletedAt: null,
          reviewStatus: { not: "VALID" },
        },
      }),
    ]);
    if (unresolved || invalidEvidence) {
      throw new BadRequestException(
        `Admin belum dapat membuka assessment lapangan: ${unresolved} butir belum diterima dan ${invalidEvidence} bukti belum valid.`,
      );
    }

    await this.flow.prisma.$transaction([
      this.flow.prisma.auditUnitPlan.update({
        where: { id: plan.id },
        data: { fieldAuditEnd, reportingEnd, followUpEnd },
      }),
      this.flow.prisma.selfAssessment.updateMany({
        where: { question: { workspaceId: id, excluded: false } },
        data: {
          responseStatus: "FIELD_PENDING",
          standardResult: null,
          processResult: null,
          score: null,
          approvedById: null,
          approvedAt: null,
          returnNote: null,
        },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "FIELD_AUDIT" },
      }),
    ]);

    for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
      await this.flow.notifyRole(
        id,
        role,
        "WORKPAPER_SUBMITTED",
        "Assessment lapangan dibuka",
        `Admin Mutu menyetujui desk review ${workspace.unit.name}. Seluruh butir wajib dinilai di lapangan.`,
        "AuditWorkspace",
        id,
      );
    }
    return { ok: true, status: "FIELD_AUDIT" };
  }

  @Post("workspaces/:id/workpapers/submit-all")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async submitAllWorkpapers(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["REPORTING"]);
    const result = await this.flow.prisma.workpaper.updateMany({
      where: {
        auditorUserId: user.id,
        question: { workspaceId: id },
        documentStatus: { in: ["DRAFT", "RETURNED"] },
      },
      data: { documentStatus: "SUBMITTED", submittedAt: new Date() },
    });
    return { ok: true, count: result.count };
  }

  @Post("workspaces/:id/workpapers/approve-all")
  @Roles("KETUA_AUDITOR")
  async approveAllWorkpapers(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["REPORTING"]);
    const now = new Date();
    const result = await this.flow.prisma.workpaper.updateMany({
      where: {
        question: { workspaceId: id },
        documentStatus: "SUBMITTED",
      },
      data: {
        documentStatus: "APPROVED",
        reviewedById: user.id,
        reviewedAt: now,
        lockedAt: now,
      },
    });
    return { ok: true, count: result.count };
  }

  private async readiness(id: string) {
    const [questions, workpapers, draftFindings] = await Promise.all([
      this.flow.prisma.auditQuestion.findMany({
        where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
        select: { id: true },
      }),
      this.flow.prisma.workpaper.findMany({
        where: { question: { workspaceId: id } },
        select: { auditQuestionId: true, documentStatus: true },
      }),
      this.flow.prisma.finding.count({
        where: { workspaceId: id, status: { in: ["DRAFT", "REVIEW"] } },
      }),
    ]);
    const finalIds = new Set(
      workpapers
        .filter((item) => ["APPROVED", "LOCKED"].includes(item.documentStatus))
        .map((item) => item.auditQuestionId),
    );
    const missingWorkpapers = questions.filter(
      (question) => !finalIds.has(question.id),
    ).length;
    return {
      questionCount: questions.length,
      finalWorkpaperCount: finalIds.size,
      missingWorkpapers,
      draftFindings,
      ready: missingWorkpapers === 0 && draftFindings === 0,
    };
  }

  @Get("workspaces/:id/reporting-readiness")
  async reportingReadiness(@Param("id") id: string, @CurrentUser() user: any) {
    await this.flow.workspace(id, user);
    return this.readiness(id);
  }

  @Post("workspaces/:id/reporting/complete")
  @Roles("KETUA_AUDITOR")
  async completeReporting(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["REPORTING"]);
    const readiness = await this.readiness(id);
    if (!readiness.ready) {
      throw new BadRequestException(
        `Pelaporan belum lengkap: ${readiness.missingWorkpapers} butir belum memiliki kertas kerja final dan ${readiness.draftFindings} temuan masih draft.`,
      );
    }

    const findingCount = await this.flow.prisma.finding.count({
      where: { workspaceId: id, status: { not: "VOID" } },
    });
    const nextStatus = findingCount ? "FOLLOW_UP" : "REPORT_REVIEW";
    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: nextStatus },
    });

    if (findingCount) {
      const auditees = await this.flow.prisma.user.findMany({
        where: {
          unitId: workspace.unitId,
          status: "ACTIVE",
          deletedAt: null,
          roles: { some: { role: { code: "AUDITEE" } } },
        },
        select: { id: true },
      });
      if (auditees.length) {
        await this.flow.prisma.notification.createMany({
          data: auditees.map((auditee) => ({
            workspaceId: id,
            recipientUserId: auditee.id,
            event: "CORRECTIVE_ACTION_SUBMITTED",
            title: "CAPA perlu disusun",
            message: `${workspace.unit.name}: ${findingCount} temuan audit perlu ditindaklanjuti.`,
            entityType: "AuditWorkspace",
            entityId: id,
          })),
        });
      }
    } else {
      await this.notifyAdmins(
        id,
        "Audit tanpa temuan siap ditutup",
        `${workspace.unit.name}: pelaporan selesai tanpa temuan yang memerlukan CAPA.`,
      );
    }
    return { ok: true, status: nextStatus };
  }
}
