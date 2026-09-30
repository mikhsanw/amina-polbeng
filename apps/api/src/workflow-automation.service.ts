import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";

@Injectable()
export class WorkflowAutomationService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
  ) {}

  onModuleInit() {
    const intervalMinutes = Math.max(
      1,
      Number(process.env.WORKFLOW_AUTOMATION_MINUTES ?? 5),
    );
    setTimeout(() => this.runDueTransitions(), 5_000);
    this.timer = setInterval(
      () => this.runDueTransitions(),
      intervalMinutes * 60_000,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private deadlinePassed(value: Date | null, now: Date) {
    if (!value) return false;
    const deadline = new Date(value);
    deadline.setUTCHours(23, 59, 59, 999);
    return deadline.getTime() < now.getTime();
  }

  private async notifyAssignment(
    workspaceId: string,
    role: string,
    event: any,
    title: string,
    message: string,
  ) {
    const assignments = await this.prisma.auditTeam.findMany({
      where: { workspaceId, role },
      select: { userId: true },
    });
    if (!assignments.length) return;
    await this.prisma.notification.createMany({
      data: assignments.map((assignment) => ({
        workspaceId,
        recipientUserId: assignment.userId,
        event,
        title,
        message,
        entityType: "AuditWorkspace",
        entityId: workspaceId,
      })),
    });
  }

  private async notifyRoleUsers(
    workspaceId: string,
    roleCode: string,
    event: any,
    title: string,
    message: string,
    unitId?: string,
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        ...(unitId ? { unitId } : {}),
        roles: { some: { role: { code: roleCode } } },
      },
      select: { id: true },
    });
    if (!recipients.length) return;
    await this.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        workspaceId,
        recipientUserId: recipient.id,
        event,
        title,
        message,
        entityType: "AuditWorkspace",
        entityId: workspaceId,
      })),
    });
  }

  private async fallbackToDefaultForVerification(workspace: any) {
    const questions = await this.prisma.auditQuestion.findMany({
      where: { workspaceId: workspace.id },
    });
    if (!questions.length) return;
    const now = new Date();
    await this.prisma.$transaction([
      ...questions.map((question) =>
        this.prisma.auditQuestion.update({
          where: { id: question.id },
          data: {
            auditorQuestion: null,
            auditorExpectedEvidence: null,
            auditorTestMethod: null,
            auditorRiskLevel: null,
            questionSnapshot: question.defaultQuestion,
            excluded: false,
            exclusionReason: null,
            changeFlag: false,
            changeFields: [],
            changeReason: null,
            auditorNote:
              "Batas telaah berakhir tanpa submit; sistem meneruskan instrumen default.",
            reviewedById: null,
            reviewedAt: now,
            verifierNote: null,
            reviewStatus: "PENDING_VERIFICATION",
          },
        }),
      ),
      this.prisma.auditWorkspace.update({
        where: { id: workspace.id },
        data: {
          instrumentStatus: "PENDING_VERIFICATION",
          status: "INSTRUMENT_APPROVAL",
          instrumentChangeCount: 0,
        },
      }),
    ]);
    await this.notifyAssignment(
      workspace.id,
      "VERIFIER",
      "INSTRUMENT_APPROVAL_REQUESTED",
      "Verifikasi instrumen dibuka otomatis",
      "Ketua Auditor melewati batas submit. Sistem meneruskan instrumen default untuk diverifikasi.",
    );
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_INSTRUMENT_REVIEW_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { questionCount: questions.length, overdue: true, fallback: "DEFAULT" },
    );
  }

  private async fallbackToDefaultApproval(workspace: any) {
    const questions = await this.prisma.auditQuestion.findMany({
      where: { workspaceId: workspace.id },
    });
    if (!questions.length) return;
    const now = new Date();
    await this.prisma.$transaction([
      ...questions.map((question) =>
        this.prisma.auditQuestion.update({
          where: { id: question.id },
          data: {
            auditorQuestion: null,
            auditorExpectedEvidence: null,
            auditorTestMethod: null,
            auditorRiskLevel: null,
            questionSnapshot: question.defaultQuestion,
            excluded: false,
            exclusionReason: null,
            changeFlag: false,
            changeFields: [],
            changeReason: null,
            verifierNote:
              "Batas verifikasi berakhir tanpa keputusan lengkap; sistem menggunakan instrumen default.",
            reviewStatus: "APPROVED",
            approvedById: null,
            approvedAt: now,
          },
        }),
      ),
      this.prisma.auditWorkspace.update({
        where: { id: workspace.id },
        data: {
          instrumentStatus: "APPROVED",
          status: "INSTRUMENT_APPROVAL",
          instrumentChangeCount: 0,
        },
      }),
    ]);
    await this.notifyRoleUsers(
      workspace.id,
      "ADMIN_MUTU",
      "INSTRUMENT_APPROVED",
      "Instrumen menunggu publikasi Admin Mutu",
      `${workspace.unit.name}: Verifikator melewati tenggat. Instrumen default disiapkan untuk keputusan publikasi.`,
    );
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_INSTRUMENT_VERIFICATION_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { questionCount: questions.length, overdue: true, fallback: "DEFAULT" },
    );
  }

  private async closeSelfAssessmentByDeadline(workspace: any) {
    const incomplete = await this.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: workspace.id, excluded: false },
        OR: [
          { implementationDescription: null },
          { implementationDescription: "" },
        ],
      },
    });
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.selfAssessment.updateMany({
        where: { question: { workspaceId: workspace.id, excluded: false } },
        data: {
          responseStatus: "SUBMITTED",
          submittedAt: now,
          returnNote:
            "Batas self-assessment berakhir; data yang tersedia dikirim otomatis untuk review Auditor.",
        },
      }),
      this.prisma.auditWorkspace.update({
        where: { id: workspace.id },
        data: { status: "DESK_REVIEW" },
      }),
    ]);
    for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
      await this.notifyAssignment(
        workspace.id,
        role,
        "SELF_ASSESSMENT_SUBMITTED",
        "Self-assessment ditutup oleh tenggat",
        `${workspace.unit.name}: ${incomplete} butir belum lengkap dan harus diperiksa dalam desk review.`,
      );
    }
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_SELF_ASSESSMENT_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { incomplete, overdue: true },
    );
  }

  private async closeDeskReviewByDeadline(workspace: any) {
    const [unresolved, pendingEvidence] = await Promise.all([
      this.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: workspace.id, excluded: false },
          responseStatus: { notIn: ["APPROVED", "RETURNED"] },
        },
      }),
      this.prisma.evidence.count({
        where: {
          workspaceId: workspace.id,
          deletedAt: null,
          reviewStatus: "PENDING",
        },
      }),
    ]);
    await this.prisma.auditWorkspace.update({
      where: { id: workspace.id },
      data: { status: "AUDIT" },
    });
    await this.notifyRoleUsers(
      workspace.id,
      "ADMIN_MUTU",
      "SELF_ASSESSMENT_APPROVED",
      "Tenggat review Auditor berakhir",
      `${workspace.unit.name}: ${unresolved} butir dan ${pendingEvidence} bukti belum diputuskan. Admin Mutu harus melanjutkan, mengembalikan, atau mengganti Auditor.`,
    );
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_DESK_REVIEW_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { unresolved, pendingEvidence, overdue: true },
    );
  }

  private async closeFieldAuditByDeadline(workspace: any) {
    const unresolved = await this.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: workspace.id, excluded: false },
        responseStatus: { notIn: ["APPROVED", "OPEN"] },
      },
    });
    await this.prisma.auditWorkspace.update({
      where: { id: workspace.id },
      data: { status: "REPORTING" },
    });
    for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
      await this.notifyAssignment(
        workspace.id,
        role,
        "WORKPAPER_SUBMITTED",
        "Assessment lapangan ditutup oleh tenggat",
        `${unresolved} butir belum mempunyai keputusan lapangan dan harus dicatat dalam laporan.`,
      );
    }
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_FIELD_AUDIT_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { unresolved, overdue: true },
    );
  }

  private async closeReportingByDeadline(workspace: any) {
    const [unfinishedWorkpapers, draftFindings] = await Promise.all([
      this.prisma.workpaper.count({
        where: {
          question: { workspaceId: workspace.id },
          documentStatus: { in: ["DRAFT", "SUBMITTED", "RETURNED"] },
        },
      }),
      this.prisma.finding.count({
        where: {
          workspaceId: workspace.id,
          status: { in: ["DRAFT", "REVIEW"] },
        },
      }),
    ]);
    await this.prisma.auditWorkspace.update({
      where: { id: workspace.id },
      data: { status: "FOLLOW_UP" },
    });
    await this.notifyRoleUsers(
      workspace.id,
      "AUDITEE",
      "CORRECTIVE_ACTION_SUBMITTED",
      "Tahap tindak lanjut dibuka",
      `${workspace.unit.name}: tenggat pelaporan berakhir dengan ${unfinishedWorkpapers} kertas kerja dan ${draftFindings} temuan belum final.`,
      workspace.unitId,
    );
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_REPORTING_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { unfinishedWorkpapers, draftFindings, overdue: true },
    );
  }

  private async closeFollowUpByDeadline(workspace: any) {
    const openFindings = await this.prisma.finding.count({
      where: {
        workspaceId: workspace.id,
        status: { notIn: ["CLOSED", "VOID"] },
      },
    });
    await this.prisma.auditWorkspace.update({
      where: { id: workspace.id },
      data: { status: "REPORT_REVIEW" },
    });
    await this.notifyRoleUsers(
      workspace.id,
      "ADMIN_MUTU",
      "VERIFICATION_REQUESTED",
      "Tenggat tindak lanjut berakhir",
      `${workspace.unit.name}: ${openFindings} temuan masih terbuka. Admin Mutu harus memeriksa sebelum penutupan audit.`,
    );
    await this.app.log(
      undefined,
      "SYSTEM",
      "AUTO_FOLLOW_UP_DEADLINE",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { openFindings, overdue: true },
    );
  }

  async runDueTransitions() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const plans = await this.prisma.auditUnitPlan.findMany({
        where: { workspaceId: { not: null } },
      });
      for (const plan of plans) {
        if (!plan.workspaceId) continue;
        const workspace = await this.prisma.auditWorkspace.findUnique({
          where: { id: plan.workspaceId },
          include: { unit: true },
        });
        if (!workspace) continue;

        if (
          ["AUDITOR_REVIEW", "RETURNED"].includes(workspace.instrumentStatus) &&
          this.deadlinePassed(plan.instrumentReviewEnd, now)
        ) {
          await this.fallbackToDefaultForVerification(workspace);
          continue;
        }

        if (
          workspace.instrumentStatus === "PENDING_VERIFICATION" &&
          this.deadlinePassed(plan.instrumentVerificationEnd, now)
        ) {
          await this.fallbackToDefaultApproval(workspace);
          continue;
        }

        if (
          workspace.status === "SELF_ASSESSMENT" &&
          this.deadlinePassed(plan.selfAssessmentEnd, now)
        ) {
          await this.closeSelfAssessmentByDeadline(workspace);
          continue;
        }

        if (
          workspace.status === "DESK_REVIEW" &&
          this.deadlinePassed(plan.selfAssessmentReviewEnd, now)
        ) {
          await this.closeDeskReviewByDeadline(workspace);
          continue;
        }

        if (
          workspace.status === "FIELD_AUDIT" &&
          this.deadlinePassed(plan.fieldAuditEnd, now)
        ) {
          await this.closeFieldAuditByDeadline(workspace);
          continue;
        }

        if (
          workspace.status === "REPORTING" &&
          this.deadlinePassed(plan.reportingEnd, now)
        ) {
          await this.closeReportingByDeadline(workspace);
          continue;
        }

        if (
          workspace.status === "FOLLOW_UP" &&
          this.deadlinePassed(plan.followUpEnd, now)
        ) {
          await this.closeFollowUpByDeadline(workspace);
        }
      }
    } catch (error) {
      console.error("Workflow automation failed", error);
    } finally {
      this.running = false;
    }
  }
}
