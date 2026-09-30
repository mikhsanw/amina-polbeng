import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow")
export class ReportSignatoryController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Get("workspaces/:id/report-signatories")
  async signatories(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const auditee = await this.flow.prisma.user.findFirst({
      where: {
        unitId: workspace.unitId,
        status: "ACTIVE",
        deletedAt: null,
        isUnitApprover: true,
        roles: { some: { role: { code: "AUDITEE" } } },
      },
      select: { id: true, fullName: true },
    });
    const lead = workspace.team.find((member) => member.role === "LEAD_AUDITOR");
    const auditors = workspace.team
      .filter((member) => member.role === "AUDITOR")
      .map((member) => ({ id: member.user.id, fullName: member.user.fullName }));
    return {
      auditee,
      leadAuditor: lead
        ? { id: lead.user.id, fullName: lead.user.fullName }
        : null,
      auditors,
    };
  }
}
