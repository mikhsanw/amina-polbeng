import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

@Controller("audit-flow")
export class AssessmentFlowReadController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly scheduleService: AuditScheduleService,
  ) {}

  @Get("workspaces/:id/assessment-flow")
  async detail(@Param("id") id: string, @CurrentUser() user: any) {
    let workspace = await this.flow.workspace(id, user);

    // Bug lama memindahkan seluruh workspace kembali ke SELF_ASSESSMENT ketika
    // satu butir dikembalikan Auditor. Dalam alur baru RETURNED adalah hasil desk
    // review dan baru boleh diperbaiki Auditee saat FIELD_AUDIT. Ketika ruang
    // kerja lama dibuka, statusnya dipulihkan agar Ketua Auditor dapat melanjutkan.
    if (workspace.status === "SELF_ASSESSMENT") {
      const legacyReturned = await this.flow.prisma.selfAssessment.count({
        where: {
          question: { workspaceId: id, excluded: false },
          responseStatus: "RETURNED",
        },
      });
      if (legacyReturned) {
        await this.flow.prisma.auditWorkspace.update({
          where: { id },
          data: { status: "DESK_REVIEW" },
        });
        workspace = await this.flow.workspace(id, user);
      }
    }

    const published = await this.flow.prisma.auditQuestion.findMany({
      where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
      select: { id: true },
    });
    if (published.length) {
      await this.flow.prisma.selfAssessment.createMany({
        data: published.map((question) => ({
          auditQuestionId: question.id,
          responseStatus:
            workspace.status === "FIELD_AUDIT" ? "FIELD_PENDING" : "NOT_STARTED",
        })),
        skipDuplicates: true,
      });
    }

    // Data lama memakai APPROVED untuk desk review sekaligus hasil lapangan.
    // APPROVED tanpa kategori dan tanpa kertas kerja harus dinilai kembali.
    if (workspace.status === "FIELD_AUDIT") {
      const legacyAccepted = await this.flow.prisma.selfAssessment.findMany({
        where: {
          question: {
            workspaceId: id,
            excluded: false,
            workpapers: { none: {} },
          },
          responseStatus: { in: ["APPROVED", "DESK_ACCEPTED"] },
          standardResult: null,
          processResult: null,
        },
        select: { id: true },
      });
      if (legacyAccepted.length) {
        await this.flow.prisma.selfAssessment.updateMany({
          where: { id: { in: legacyAccepted.map((item) => item.id) } },
          data: {
            responseStatus: "FIELD_PENDING",
            approvedById: null,
            approvedAt: null,
          },
        });
      }
    }

    const [questions, evidences, schedule] = await Promise.all([
      this.flow.prisma.auditQuestion.findMany({
        where: { workspaceId: id, reviewStatus: "PUBLISHED", excluded: false },
        include: {
          assessment: true,
          masterQuestion: { include: { standard: true, isoClause: true } },
          evidences: {
            where: { deletedAt: null },
            include: { uploadedBy: { select: { id: true, fullName: true } } },
            orderBy: { uploadedAt: "desc" },
          },
          findings: { orderBy: { createdAt: "desc" } },
          workpapers: {
            include: { auditor: { select: { id: true, fullName: true } } },
            orderBy: { updatedAt: "desc" },
          },
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
      this.scheduleService.detail(id),
    ]);

    return { workspace, questions, evidences, schedule };
  }
}
