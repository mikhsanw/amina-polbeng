import { BadRequestException, Controller, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { SIGNED_ARCHIVE_MARKER } from "./audit-archive.controller";

@Controller("audit-flow")
export class DeadlineCloseController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Post("workspaces/:id/close")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async close(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.status, ["REPORT_REVIEW"]);
    const [openFindings, archiveDocuments] = await Promise.all([
      this.flow.prisma.finding.count({
        where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
      }),
      this.flow.prisma.evidence.findMany({
        where: {
          workspaceId: id,
          auditQuestionId: null,
          description: SIGNED_ARCHIVE_MARKER,
          deletedAt: null,
        },
        select: { id: true, reviewStatus: true },
      }),
    ]);
    if (openFindings) {
      throw new BadRequestException(`${openFindings} temuan belum ditutup.`);
    }
    if (!archiveDocuments.length) {
      throw new BadRequestException(
        "Laporan bertanda tangan belum diunggah pada menu Archive.",
      );
    }
    const notValid = archiveDocuments.filter(
      (document) => document.reviewStatus !== "VALID",
    ).length;
    if (notValid) {
      throw new BadRequestException(
        `${notValid} dokumen Archive belum dinyatakan Valid oleh Admin Mutu.`,
      );
    }
    const closed = await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "CLOSED" },
    });
    await this.flow.log(
      user.id,
      user.username,
      "AUDIT_CLOSED",
      "AuditWorkspace",
      id,
      id,
      { status: "CLOSED", archiveDocumentCount: archiveDocuments.length },
    );
    return closed;
  }
}
