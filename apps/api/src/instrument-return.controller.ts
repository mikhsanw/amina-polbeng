import { BadRequestException, Body, Controller, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow/workspaces/:id/instrument")
export class InstrumentReturnController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Post("return-review")
  @Roles("VERIFIKATOR")
  async returnReview(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, ["PENDING_VERIFICATION"]);
    const note = String(body.note ?? "").trim();
    if (!note) throw new BadRequestException("Catatan pengembalian wajib diisi.");

    const [invalidQuestions, pending] = await Promise.all([
      this.flow.prisma.auditQuestion.findMany({
        where: { workspaceId: id, reviewStatus: "RETURNED" },
        select: { id: true, verifierNote: true },
      }),
      this.flow.prisma.auditQuestion.count({
        where: { workspaceId: id, reviewStatus: "PENDING_VERIFICATION" },
      }),
    ]);
    if (pending) {
      throw new BadRequestException(`Masih ada ${pending} butir yang belum diperiksa Verifikator.`);
    }
    if (!invalidQuestions.length) {
      throw new BadRequestException("Tidak ada butir tidak valid yang dapat dikembalikan.");
    }

    await this.flow.prisma.$transaction([
      ...invalidQuestions.map((question) =>
        this.flow.prisma.auditQuestion.update({
          where: { id: question.id },
          data: {
            verifierNote: [question.verifierNote, `Catatan pengembalian: ${note}`]
              .filter(Boolean)
              .join("\n\n"),
          },
        }),
      ),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { instrumentStatus: "RETURNED", status: "INSTRUMENT_REVIEW" },
      }),
    ]);

    for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
      await this.flow.notifyRole(
        id,
        role,
        "INSTRUMENT_RETURNED",
        `${invalidQuestions.length} butir instrumen dikembalikan`,
        note,
        "AuditWorkspace",
        id,
      );
    }
    await this.flow.log(user.id, user.username, "INSTRUMENT_REVIEW_RETURNED", "AuditWorkspace", id, id, {
      note,
      invalid: invalidQuestions.length,
    });
    return { ok: true, status: "RETURNED", invalid: invalidQuestions.length };
  }
}
