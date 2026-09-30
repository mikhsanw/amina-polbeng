import { BadRequestException, Controller, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

@Controller("audit-flow")
export class FieldCorrectionSubmitController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  @Post("workspaces/:id/field-corrections/submit")
  @Roles("AUDITEE")
  async submit(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new BadRequestException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
    await this.schedule.requireOpen(id, "FIELD_AUDIT");

    const corrections = await this.flow.prisma.selfAssessment.findMany({
      where: {
        question: { workspaceId: id, excluded: false },
        responseStatus: "IN_PROGRESS",
      },
      select: {
        id: true,
        auditQuestionId: true,
        implementationDescription: true,
        evidenceSummary: true,
        constraintNote: true,
        returnNote: true,
      },
    });
    if (!corrections.length) {
      throw new BadRequestException(
        "Belum ada perbaikan lapangan yang disimpan untuk dikirim kepada Auditor.",
      );
    }

    const incomplete = corrections.filter(
      (item) => !String(item.implementationDescription || "").trim(),
    );
    if (incomplete.length) {
      throw new BadRequestException(
        `${incomplete.length} butir perbaikan belum memiliki uraian kondisi/pelaksanaan.`,
      );
    }

    const now = new Date();
    await this.flow.prisma.selfAssessment.updateMany({
      where: { id: { in: corrections.map((item) => item.id) } },
      data: {
        responseStatus: "FIELD_CORRECTION_SUBMITTED",
        submittedById: user.id,
        submittedAt: now,
        approvedById: null,
        approvedAt: null,
      },
    });

    for (const correction of corrections) {
      await this.flow.log(
        user.id,
        user.username,
        "FIELD_CORRECTION_SUBMITTED",
        "SelfAssessment",
        correction.id,
        id,
        {
          auditQuestionId: correction.auditQuestionId,
          implementationDescription: correction.implementationDescription,
          evidenceSummary: correction.evidenceSummary,
          constraintNote: correction.constraintNote,
          submittedAt: now.toISOString(),
        },
        {
          returnNote: correction.returnNote,
          responseStatus: "IN_PROGRESS",
        },
      );
    }

    const message = `${workspace.unit.name}: ${corrections.length} perbaikan lapangan telah dikirim dan siap diperiksa.`;
    for (const role of ["AUDITOR", "LEAD_AUDITOR"]) {
      await this.flow.notifyRole(
        id,
        role,
        "SELF_ASSESSMENT_SUBMITTED",
        "Perbaikan lapangan siap diperiksa",
        message,
        "AuditWorkspace",
        id,
      );
    }

    return {
      ok: true,
      count: corrections.length,
      status: "FIELD_CORRECTION_SUBMITTED",
    };
  }
}
