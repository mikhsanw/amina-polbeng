import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

const DEADLINE_FIELDS = [
  "instrumentReviewEnd",
  "instrumentVerificationEnd",
  "selfAssessmentEnd",
  "selfAssessmentReviewEnd",
  "fieldAuditEnd",
  "reportingEnd",
  "followUpEnd",
] as const;

type DeadlineField = (typeof DEADLINE_FIELDS)[number];

function parseDate(value: unknown, label: string, required = false) {
  if (value == null || value === "") {
    if (required) throw new BadRequestException(`${label} wajib diisi.`);
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} tidak valid.`);
  }
  return date;
}

function endOfDay(value: Date) {
  const result = new Date(value);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

@Controller("audit-flow")
export class WorkflowDeadlineController {
  constructor(private readonly flow: AmiWorkflowService) {}

  private async plan(workspaceId: string) {
    const plan = await this.flow.prisma.auditUnitPlan.findUnique({
      where: { workspaceId },
    });
    if (!plan) {
      throw new BadRequestException(
        "Rencana tahapan audit untuk workspace ini tidak ditemukan.",
      );
    }
    const program = await this.flow.prisma.auditProgram.findUniqueOrThrow({
      where: { id: plan.programId },
    });
    return { plan, program };
  }

  private validateBounds(
    dates: Array<Date | null>,
    program: { startDate: Date; endDate: Date },
  ) {
    const start = new Date(program.startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = endOfDay(program.endDate);
    for (const date of dates) {
      if (!date) continue;
      const deadline = endOfDay(date);
      if (deadline.getTime() < start.getTime() || deadline.getTime() > end.getTime()) {
        throw new BadRequestException(
          "Seluruh batas akhir harus berada dalam rentang program audit.",
        );
      }
    }
  }

  private validateOrder(dates: Array<Date | null>) {
    let previous: Date | null = null;
    for (const current of dates) {
      if (!current) continue;
      if (previous && endOfDay(current).getTime() < endOfDay(previous).getTime()) {
        throw new BadRequestException(
          "Urutan batas akhir tahapan tidak boleh mendahului tahapan sebelumnya.",
        );
      }
      previous = current;
    }
  }

  private async notifyAdmins(
    workspaceId: string,
    title: string,
    message: string,
  ) {
    const users = await this.flow.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "ADMIN_MUTU" } } },
      },
      select: { id: true },
    });
    if (!users.length) return;
    await this.flow.prisma.notification.createMany({
      data: users.map((user) => ({
        workspaceId,
        recipientUserId: user.id,
        event: "SELF_ASSESSMENT_APPROVED",
        title,
        message,
        entityType: "AuditWorkspace",
        entityId: workspaceId,
      })),
    });
  }

  @Get("workspaces/:id/deadlines")
  async deadlines(@Param("id") id: string, @CurrentUser() user: any) {
    await this.flow.workspace(id, user);
    const { plan } = await this.plan(id);
    return plan;
  }

  @Put("workspaces/:id/deadlines")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async updateDeadlines(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    const { plan, program } = await this.plan(id);
    const update: Record<string, Date | null> = {};
    for (const field of DEADLINE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        update[field] = parseDate(body[field], field);
      }
    }
    const merged = DEADLINE_FIELDS.map((field) =>
      Object.prototype.hasOwnProperty.call(update, field)
        ? update[field]
        : (plan[field] as Date | null),
    );
    this.validateBounds(merged, program);
    this.validateOrder(merged);
    const saved = await this.flow.prisma.auditUnitPlan.update({
      where: { id: plan.id },
      data: update,
    });
    await this.flow.log(
      user.id,
      user.username,
      "WORKFLOW_DEADLINES_UPDATED",
      "AuditWorkspace",
      id,
      id,
      { unitId: workspace.unitId, fields: Object.keys(update) },
    );
    return saved;
  }

  @Post("workspaces/:id/desk-review/submit")
  @Roles("KETUA_AUDITOR")
  async submitDeskReview(@Param("id") id: string, @CurrentUser() user: any) {
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
    await this.notifyAdmins(
      id,
      "Review Auditor menunggu keputusan Admin Mutu",
      `${workspace.unit.name}: seluruh review telah diselesaikan sebelum batas akhir.`,
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
    const fieldAuditEnd = parseDate(
      body.fieldAuditEnd,
      "Batas akhir assessment lapangan",
      true,
    )!;
    const reportingEnd = parseDate(
      body.reportingEnd,
      "Batas akhir penyusunan laporan",
      true,
    )!;
    const followUpEnd = parseDate(
      body.followUpEnd,
      "Batas akhir CAPA/tindak lanjut",
      true,
    )!;
    this.validateBounds([fieldAuditEnd, reportingEnd, followUpEnd], program);
    this.validateOrder([
      plan.selfAssessmentReviewEnd,
      fieldAuditEnd,
      reportingEnd,
      followUpEnd,
    ]);
    await this.flow.prisma.$transaction([
      this.flow.prisma.auditUnitPlan.update({
        where: { id: plan.id },
        data: { fieldAuditEnd, reportingEnd, followUpEnd },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "FIELD_AUDIT" },
      }),
    ]);
    await this.flow.notifyRole(
      id,
      "LEAD_AUDITOR",
      "WORKPAPER_SUBMITTED",
      "Assessment lapangan dibuka",
      `Admin Mutu menyetujui hasil review ${workspace.unit.name}.`,
      "AuditWorkspace",
      id,
    );
    await this.flow.notifyRole(
      id,
      "AUDITOR",
      "WORKPAPER_SUBMITTED",
      "Assessment lapangan dibuka",
      `Admin Mutu menyetujui hasil review ${workspace.unit.name}.`,
      "AuditWorkspace",
      id,
    );
    await this.flow.log(
      user.id,
      user.username,
      "DESK_REVIEW_APPROVED_BY_ADMIN",
      "AuditWorkspace",
      id,
      id,
      {
        note: String(body.note ?? "").trim() || null,
        fieldAuditEnd,
        reportingEnd,
        followUpEnd,
      },
    );
    return { ok: true, status: "FIELD_AUDIT" };
  }

  @Post("workspaces/:id/desk-review/return")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async returnDeskReview(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.status, ["AUDIT"]);
    const note = String(body.note ?? "").trim();
    if (!note) throw new BadRequestException("Catatan pengembalian wajib diisi.");
    const deadline = parseDate(
      body.selfAssessmentReviewEnd,
      "Batas akhir review ulang",
      true,
    )!;
    const { plan, program } = await this.plan(id);
    this.validateBounds([deadline], program);
    await this.flow.prisma.$transaction([
      this.flow.prisma.auditUnitPlan.update({
        where: { id: plan.id },
        data: { selfAssessmentReviewEnd: deadline },
      }),
      this.flow.prisma.selfAssessment.updateMany({
        where: { question: { workspaceId: id, excluded: false } },
        data: {
          responseStatus: "SUBMITTED",
          approvedById: null,
          approvedAt: null,
          returnNote: `Dikembalikan Admin Mutu: ${note}`,
        },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { status: "DESK_REVIEW" },
      }),
    ]);
    for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
      await this.flow.notifyRole(
        id,
        role,
        "SELF_ASSESSMENT_RETURNED",
        "Review dikembalikan Admin Mutu",
        note,
        "AuditWorkspace",
        id,
      );
    }
    await this.flow.log(
      user.id,
      user.username,
      "DESK_REVIEW_RETURNED_BY_ADMIN",
      "AuditWorkspace",
      id,
      id,
      { note, deadline },
    );
    return { ok: true, status: "DESK_REVIEW" };
  }

  @Post("workspaces/:id/desk-review/reassign")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async reassignReviewer(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.status, ["AUDIT"]);
    const oldUserId = String(body.oldUserId ?? "").trim();
    const newUserId = String(body.newUserId ?? "").trim();
    const note = String(body.note ?? "").trim();
    if (!oldUserId || !newUserId || !note) {
      throw new BadRequestException(
        "Auditor lama, Auditor pengganti, dan alasan penggantian wajib diisi.",
      );
    }
    const deadline = parseDate(
      body.selfAssessmentReviewEnd,
      "Batas akhir review ulang",
      true,
    )!;
    const assignment = await this.flow.prisma.auditTeam.findFirst({
      where: {
        workspaceId: id,
        userId: oldUserId,
        role: { in: ["AUDITOR", "LEAD_AUDITOR"] },
      },
    });
    if (!assignment) {
      throw new BadRequestException("Penugasan Auditor lama tidak ditemukan.");
    }
    const replacement = await this.flow.prisma.user.findUniqueOrThrow({
      where: { id: newUserId },
      include: { roles: { include: { role: true } } },
    });
    if (replacement.status !== "ACTIVE" || replacement.deletedAt) {
      throw new BadRequestException("Auditor pengganti tidak aktif.");
    }
    if (replacement.unitId === workspace.unitId) {
      throw new BadRequestException(
        "Auditor pengganti berasal dari unit Auditee dan menimbulkan konflik kepentingan.",
      );
    }
    const systemRoles = replacement.roles.map((item) => item.role.code);
    const eligible =
      assignment.role === "LEAD_AUDITOR"
        ? systemRoles.includes("KETUA_AUDITOR")
        : systemRoles.some((role) => ["AUDITOR", "KETUA_AUDITOR"].includes(role));
    if (!eligible) {
      throw new BadRequestException(
        "Role Auditor pengganti tidak sesuai dengan penugasan.",
      );
    }
    const duplicate = await this.flow.prisma.auditTeam.count({
      where: { workspaceId: id, userId: newUserId },
    });
    if (duplicate) {
      throw new BadRequestException(
        "Auditor pengganti sudah mempunyai penugasan pada workspace ini.",
      );
    }
    const { plan, program } = await this.plan(id);
    this.validateBounds([deadline], program);
    await this.flow.prisma.$transaction(async (transaction) => {
      await transaction.auditTeam.delete({ where: { id: assignment.id } });
      await transaction.auditTeam.create({
        data: { workspaceId: id, userId: newUserId, role: assignment.role },
      });
      await transaction.auditUnitPlanAssignment.deleteMany({
        where: { planId: plan.id, userId: oldUserId, role: assignment.role },
      });
      await transaction.auditUnitPlanAssignment.create({
        data: { planId: plan.id, userId: newUserId, role: assignment.role },
      });
      await transaction.auditUnitPlan.update({
        where: { id: plan.id },
        data: { selfAssessmentReviewEnd: deadline },
      });
      await transaction.selfAssessment.updateMany({
        where: { question: { workspaceId: id, excluded: false } },
        data: {
          responseStatus: "SUBMITTED",
          approvedById: null,
          approvedAt: null,
          returnNote: `Review ulang karena pergantian Auditor: ${note}`,
        },
      });
      await transaction.auditWorkspace.update({
        where: { id },
        data: { status: "DESK_REVIEW" },
      });
    });
    await this.flow.prisma.notification.create({
      data: {
        workspaceId: id,
        recipientUserId: newUserId,
        event: "SELF_ASSESSMENT_SUBMITTED",
        title: "Penugasan review ulang",
        message: note,
        entityType: "AuditWorkspace",
        entityId: id,
      },
    });
    await this.flow.log(
      user.id,
      user.username,
      "DESK_REVIEW_AUDITOR_REASSIGNED",
      "AuditWorkspace",
      id,
      id,
      { oldUserId, newUserId, role: assignment.role, note, deadline },
    );
    return { ok: true, status: "DESK_REVIEW" };
  }

  @Post("workspaces/:id/reporting/complete")
  @Roles("KETUA_AUDITOR")
  async completeReporting(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["REPORTING"]);
    const [unfinishedWorkpapers, draftFindings] = await Promise.all([
      this.flow.prisma.workpaper.count({
        where: {
          question: { workspaceId: id },
          documentStatus: { in: ["DRAFT", "SUBMITTED", "RETURNED"] },
        },
      }),
      this.flow.prisma.finding.count({
        where: { workspaceId: id, status: { in: ["DRAFT", "REVIEW"] } },
      }),
    ]);
    if (unfinishedWorkpapers || draftFindings) {
      throw new BadRequestException(
        `Pelaporan belum lengkap: ${unfinishedWorkpapers} kertas kerja dan ${draftFindings} temuan masih belum final.`,
      );
    }
    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "FOLLOW_UP" },
    });
    await this.flow.log(
      user.id,
      user.username,
      "REPORTING_COMPLETED",
      "AuditWorkspace",
      id,
      id,
      { unfinishedWorkpapers, draftFindings },
    );
    return { ok: true, status: "FOLLOW_UP" };
  }

  @Post("workspaces/:id/follow-up/complete")
  @Roles("KETUA_AUDITOR")
  async completeFollowUp(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.status, ["FOLLOW_UP"]);
    const openFindings = await this.flow.prisma.finding.count({
      where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
    });
    if (openFindings) {
      throw new BadRequestException(`${openFindings} temuan belum ditutup.`);
    }
    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "REPORT_REVIEW" },
    });
    await this.notifyAdmins(
      id,
      "Audit siap ditutup",
      `${workspace.unit.name}: seluruh tindak lanjut telah diverifikasi.`,
    );
    await this.flow.log(
      user.id,
      user.username,
      "FOLLOW_UP_COMPLETED",
      "AuditWorkspace",
      id,
      id,
      { openFindings },
    );
    return { ok: true, status: "REPORT_REVIEW" };
  }
}
