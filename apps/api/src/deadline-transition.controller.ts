import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

function requiredDate(value: unknown, label: string) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} wajib diisi dan harus valid.`);
  }
  return date;
}

@Controller("audit-flow")
export class DeadlineTransitionController {
  constructor(private readonly flow: AmiWorkflowService) {}

  private async notifyAdmin(
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

  private async notifyAuditee(
    workspaceId: string,
    unitId: string,
    title: string,
    message: string,
  ) {
    const auditees = await this.flow.prisma.user.findMany({
      where: {
        unitId,
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "AUDITEE" } } },
      },
      select: { id: true },
    });
    if (!auditees.length) return;
    await this.flow.prisma.notification.createMany({
      data: auditees.map((auditee) => ({
        workspaceId,
        recipientUserId: auditee.id,
        event: "SELF_ASSESSMENT_OPENED",
        title,
        message,
        entityType: "AuditWorkspace",
        entityId: workspaceId,
      })),
    });
  }

  @Post("workspaces/:id/instrument/activate")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async activateInstrument(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.instrumentStatus, ["APPROVED"]);
    const plan = await this.flow.prisma.auditUnitPlan.findUnique({
      where: { workspaceId: id },
    });
    if (!plan) {
      throw new BadRequestException("Rencana audit unit tidak ditemukan.");
    }

    const selfAssessmentEnd = body.selfAssessmentEnd
      ? requiredDate(body.selfAssessmentEnd, "Batas akhir unggah Auditee")
      : plan.selfAssessmentEnd;
    const selfAssessmentReviewEnd = body.selfAssessmentReviewEnd
      ? requiredDate(
          body.selfAssessmentReviewEnd,
          "Batas akhir review Auditor",
        )
      : plan.selfAssessmentReviewEnd;

    if (!selfAssessmentEnd || !selfAssessmentReviewEnd) {
      throw new BadRequestException(
        "Admin Mutu harus menetapkan batas akhir unggah Auditee dan review Auditor sebelum publikasi.",
      );
    }
    if (selfAssessmentReviewEnd.getTime() < selfAssessmentEnd.getTime()) {
      throw new BadRequestException(
        "Batas review Auditor tidak boleh lebih awal dari batas unggah Auditee.",
      );
    }
    if (workspace.program) {
      const programStart = new Date(workspace.program.startDate);
      const programEnd = new Date(workspace.program.endDate);
      programEnd.setUTCHours(23, 59, 59, 999);
      if (
        selfAssessmentEnd.getTime() < programStart.getTime() ||
        selfAssessmentReviewEnd.getTime() > programEnd.getTime()
      ) {
        throw new BadRequestException(
          "Tenggat Auditee dan Auditor harus berada dalam rentang program audit.",
        );
      }
    }

    await this.flow.prisma.auditUnitPlan.update({
      where: { id: plan.id },
      data: {
        selfAssessmentStart: null,
        selfAssessmentEnd,
        selfAssessmentReviewStart: null,
        selfAssessmentReviewEnd,
      },
    });
    const result = await this.flow.publishInstrument(
      id,
      user,
      String(body.note ?? "Instrumen dipublikasikan Admin Mutu."),
    );
    await this.notifyAuditee(
      id,
      workspace.unitId,
      "Self-assessment dibuka",
      `Instrumen ${workspace.unit.name} telah dipublikasikan. Batas unggah: ${selfAssessmentEnd.toLocaleDateString("id-ID")}.`,
    );
    await this.flow.log(
      user.id,
      user.username,
      "INSTRUMENT_PUBLISHED_WITH_DEADLINES",
      "AuditWorkspace",
      id,
      id,
      { selfAssessmentEnd, selfAssessmentReviewEnd },
    );
    return { ...result, status: "PUBLISHED" };
  }

  @Post("workspaces/:id/field-audit/open")
  @Roles("KETUA_AUDITOR")
  async submitReviewToAdmin(
    @Param("id") id: string,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
    const [unresolved, pendingEvidence] = await Promise.all([
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
    if (unresolved || pendingEvidence) {
      throw new BadRequestException(
        `Review belum lengkap: ${unresolved} butir dan ${pendingEvidence} bukti belum diputuskan.`,
      );
    }
    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "AUDIT" },
    });
    await this.notifyAdmin(
      id,
      "Review Auditor menunggu keputusan",
      `${workspace.unit.name}: review selesai dan menunggu keputusan Admin Mutu.`,
    );
    await this.flow.log(
      user.id,
      user.username,
      "DESK_REVIEW_SUBMITTED_TO_ADMIN",
      "AuditWorkspace",
      id,
      id,
      { unresolved, pendingEvidence },
    );
    return { ok: true, status: "AUDIT" };
  }
}
