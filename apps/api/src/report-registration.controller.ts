import {
  Body,
  Controller,
  Delete,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow")
export class ReportRegistrationController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Post("workspaces/:id/print")
  @Roles("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN")
  async register(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    const type = String(body.type || "AUDIT_REPORT").trim().toUpperCase();
    const latest = await this.flow.prisma.printDocument.aggregate({
      where: { workspaceId: id, type },
      _max: { version: true },
    });
    const version = (latest._max.version || 0) + 1;
    const fileName = `${type}_${workspace.unit.slug}_${workspace.auditYear}_v${version}.pdf`;
    const record = await this.flow.prisma.printDocument.create({
      data: {
        workspaceId: id,
        type,
        fileName,
        version,
        storageKey: `dynamic://audit-report/${id}/${version}`,
        status: "READY",
      },
    });
    await this.flow.log(
      user.id,
      user.username,
      "AUDIT_REPORT_VERSION_CREATED",
      "PrintDocument",
      record.id,
      id,
      { type, version, fileName },
    );
    return record;
  }

  @Delete("print-documents/:id")
  @Roles("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN")
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    const record = await this.flow.prisma.printDocument.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException("Versi laporan tidak ditemukan.");

    await this.flow.workspace(record.workspaceId, user);

    // Laporan ini dibentuk dinamis dari data audit. Menghapus record berarti
    // PDF tidak lagi dapat dibuka atau diunduh melalui endpoint dokumen.
    await this.flow.prisma.printDocument.delete({ where: { id } });

    await this.flow.log(
      user.id,
      user.username,
      "AUDIT_REPORT_VERSION_DELETED",
      "PrintDocument",
      id,
      record.workspaceId,
      {
        type: record.type,
        version: record.version,
        fileName: record.fileName,
        permanentlyDeleted: true,
      },
    );

    return { ok: true, deletedId: id };
  }
}
