import {
  BadRequestException,
  Body,
  Controller,
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
export class DeskReviewCorrectionController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  private async plan(workspaceId: string) {
    const plan = await this.flow.prisma.auditUnitPlan.findUnique({
      where: { workspaceId },
    });
    if (!plan) throw new BadRequestException("Rencana audit unit tidak ditemukan.");
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
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW", "FIELD_AUDIT"]);
    await this.schedule.requireOpen(
      workspace.id,
      workspace.status === "FIELD_AUDIT"
        ? "FIELD_AUDIT"
        : "SELF_ASSESSMENT_REVIEW",
    );

    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (!["VALID", "INVALID"].includes(decision)) {
      throw new BadRequestException("Pilih status bukti Valid atau Tidak Valid.");
    }
    const note = String(body.note ?? "").trim();
    if (decision === "INVALID" && !note) {
      throw new BadRequestException("Catatan wajib diisi untuk bukti yang tidak valid.");
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
        phase: workspace.status,
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
    const assignment = workspace.team.find(
      (member: any) => member.userId === user.id,
    );
    if (!assignment) {
      throw new BadRequestException("Penugasan Auditor tidak ditemukan.");
    }
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
    await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT_REVIEW");

    const allowedStatuses =
      assignment.role === "LEAD_AUDITOR"
        ? ["SUBMITTED", "RETURNED", "DESK_ACCEPTED"]
        : ["SUBMITTED"];
    this.flow.requireStatus(assessment.responseStatus, allowedStatuses);

    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (!["ACCEPT", "RETURN"].includes(decision)) {
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
        `Masih ada ${invalidEvidence} bukti tidak valid. Ubah bukti menjadi Valid atau tandai butir untuk diperbaiki saat assessment lapangan.`,
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

    if (!accepted && assignment.role !== "LEAD_AUDITOR") {
      await this.flow.notifyRole(
        workspace.id,
        "LEAD_AUDITOR",
        "SELF_ASSESSMENT_RETURNED",
        "Butir ditandai perlu perbaikan lapangan",
        "Auditor menandai satu butir untuk diperbaiki Auditee saat assessment lapangan.",
        "SelfAssessment",
        id,
      );
    }

    await this.flow.log(
      user.id,
      user.username,
      accepted
        ? "SELF_ASSESSMENT_DESK_ACCEPTED"
        : "SELF_ASSESSMENT_FIELD_CORRECTION_REQUIRED",
      "SelfAssessment",
      id,
      workspace.id,
      {
        decision,
        note: note || null,
        correctionPhase: accepted ? null : "FIELD_AUDIT",
      },
    );
    return updated;
  }

  @Post("workspaces/:id/desk-review/submit")
  @Roles("KETUA_AUDITOR")
  async submitDeskReview(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);

    const [unresolved, pendingEvidence, returned, invalidEvidence] =
      await Promise.all([
        this.flow.prisma.selfAssessment.count({
          where: {
            question: { workspaceId: id, excluded: false },
            responseStatus: { notIn: ["DESK_ACCEPTED", "RETURNED"] },
          },
        }),
        this.flow.prisma.evidence.count({
          where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
        }),
        this.flow.prisma.selfAssessment.count({
          where: {
            question: { workspaceId: id, excluded: false },
            responseStatus: "RETURNED",
          },
        }),
        this.flow.prisma.evidence.count({
          where: { workspaceId: id, deletedAt: null, reviewStatus: "INVALID" },
        }),
      ]);

    if (unresolved || pendingEvidence) {
      throw new BadRequestException(
        `Review belum lengkap: ${unresolved} butir belum diputuskan dan ${pendingEvidence} bukti belum diperiksa.`,
      );
    }

    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "AUDIT" },
    });
    await this.notifyAdmins(
      id,
      "Review Auditor menunggu keputusan Admin Mutu",
      `${workspace.unit.name}: review selesai. ${returned} butir dan ${invalidEvidence} bukti memerlukan perhatian saat assessment lapangan.`,
    );
    return {
      ok: true,
      status: "AUDIT",
      returnedItems: returned,
      invalidEvidences: invalidEvidence,
    };
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

    const [unresolved, pendingEvidence, returned] = await Promise.all([
      this.flow.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: { notIn: ["DESK_ACCEPTED", "RETURNED"] },
        },
      }),
      this.flow.prisma.evidence.count({
        where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
      }),
      this.flow.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: "RETURNED",
        },
      }),
    ]);
    if (unresolved || pendingEvidence) {
      throw new BadRequestException(
        `Admin belum dapat membuka assessment lapangan: ${unresolved} butir belum diputuskan dan ${pendingEvidence} bukti belum diperiksa.`,
      );
    }

    await this.flow.prisma.$transaction([
      this.flow.prisma.auditUnitPlan.update({
        where: { id: plan.id },
        data: { fieldAuditEnd, reportingEnd, followUpEnd },
      }),
      this.flow.prisma.selfAssessment.updateMany({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: "DESK_ACCEPTED",
        },
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
      this.flow.prisma.selfAssessment.updateMany({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: "RETURNED",
        },
        data: {
          standardResult: null,
          processResult: null,
          score: null,
          approvedById: null,
          approvedAt: null,
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
        `Admin Mutu membuka assessment lapangan ${workspace.unit.name}. ${returned} butir memerlukan perbaikan Auditee di tahap ini.`,
        "AuditWorkspace",
        id,
      );
    }

    if (returned) {
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
            event: "SELF_ASSESSMENT_RETURNED",
            title: "Perbaikan dibuka saat assessment lapangan",
            message: `${returned} butir dikembalikan Auditor dan sekarang dapat diperbaiki pada tahap assessment lapangan.`,
            entityType: "AuditWorkspace",
            entityId: id,
          })),
        });
      }
    }

    return { ok: true, status: "FIELD_AUDIT", returnedItems: returned };
  }
}
