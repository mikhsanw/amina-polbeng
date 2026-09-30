import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow/workspaces/:id/instrument")
export class InstrumentApprovalController {
  constructor(private readonly flow: AmiWorkflowService) {}

  private async notifyAdminMutu(
    workspaceId: string,
    title: string,
    message: string,
  ) {
    const recipients = await this.flow.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "ADMIN_MUTU" } } },
      },
      select: { id: true },
    });
    if (!recipients.length) return;
    await this.flow.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        workspaceId,
        recipientUserId: recipient.id,
        event: "INSTRUMENT_APPROVED",
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
    const recipients = await this.flow.prisma.user.findMany({
      where: {
        unitId,
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "AUDITEE" } } },
      },
      select: { id: true },
    });
    if (!recipients.length) return;
    await this.flow.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        workspaceId,
        recipientUserId: recipient.id,
        event: "SELF_ASSESSMENT_OPENED",
        title,
        message,
        entityType: "AuditWorkspace",
        entityId: workspaceId,
      })),
    });
  }

  @Get("history")
  async history(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const previousWorkspace = await this.flow.prisma.auditWorkspace.findFirst({
      where: {
        unitId: workspace.unitId,
        auditYear: { lt: workspace.auditYear },
        status: { notIn: ["CANCELLED"] },
      },
      orderBy: { auditYear: "desc" },
      select: { id: true, auditYear: true, name: true },
    });
    if (!previousWorkspace) {
      return { previousWorkspace: null, questions: [] };
    }
    const questions = await this.flow.prisma.auditQuestion.findMany({
      where: { workspaceId: previousWorkspace.id },
      include: { assessment: true },
      orderBy: { sortOrder: "asc" },
    });
    return {
      previousWorkspace,
      questions: questions.map((question) => ({
        masterQuestionId: question.masterQuestionId,
        question:
          question.publishedQuestion ??
          question.questionSnapshot ??
          question.defaultQuestion,
        excluded: question.excluded,
        response: question.assessment?.implementationDescription ?? null,
        evidenceSummary: question.assessment?.evidenceSummary ?? null,
        constraintNote: question.assessment?.constraintNote ?? null,
        standardResult: question.assessment?.standardResult ?? null,
        processResult: question.assessment?.processResult ?? null,
        responseStatus: question.assessment?.responseStatus ?? null,
      })),
    };
  }

  @Post("questions/:questionId/verify")
  @Roles("VERIFIKATOR")
  async verifyQuestion(
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "PENDING_VERIFICATION",
    ]);

    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (!["VALID", "INVALID"].includes(decision)) {
      throw new BadRequestException("Pilih keputusan Valid atau Tidak Valid.");
    }
    const note = String(body.note ?? "").trim();
    if (decision === "INVALID" && !note) {
      throw new BadRequestException(
        "Catatan wajib diisi untuk butir yang dinyatakan tidak valid.",
      );
    }

    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id: questionId },
    });
    if (question.workspaceId !== id) {
      throw new BadRequestException(
        "Pertanyaan tidak berasal dari ruang kerja yang sedang diverifikasi.",
      );
    }
    if (question.reviewStatus !== "PENDING_VERIFICATION") {
      throw new BadRequestException(
        `Butir terkunci pada status ${question.reviewStatus}.`,
      );
    }

    const valid = decision === "VALID";
    const [updated] = await this.flow.prisma.$transaction([
      this.flow.prisma.auditQuestion.update({
        where: { id: questionId },
        data: {
          reviewStatus: valid ? "APPROVED" : "RETURNED",
          verifierNote: note || null,
          approvedById: valid ? user.id : null,
          approvedAt: valid ? new Date() : null,
        },
      }),
      this.flow.prisma.instrumentChangeReview.create({
        data: {
          workspaceId: id,
          auditQuestionId: questionId,
          verifierUserId: user.id,
          decision: valid ? "APPROVE" : "RETURN",
          note: note || null,
          beforeValue: this.flow.questionDefault(question),
          proposedValue: this.flow.questionProposal(question),
        },
      }),
    ]);

    await this.flow.log(
      user.id,
      user.username,
      valid ? "INSTRUMENT_ITEM_VALIDATED" : "INSTRUMENT_ITEM_INVALIDATED",
      "AuditQuestion",
      questionId,
      id,
      { decision, note: note || null },
    );
    return updated;
  }

  @Post("submit-review")
  @Roles("KETUA_AUDITOR")
  async submitReview(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "AUDITOR_REVIEW",
      "RETURNED",
      "DRAFT",
    ]);

    const total = await this.flow.prisma.auditQuestion.count({
      where: { workspaceId: id },
    });
    if (!total) throw new BadRequestException("Instrumen belum dibentuk.");

    const unreviewed = await this.flow.prisma.auditQuestion.count({
      where: {
        workspaceId: id,
        reviewedAt: null,
        reviewStatus: { not: "APPROVED" },
      },
    });
    if (unreviewed) {
      throw new BadRequestException(
        `Masih ada ${unreviewed} butir yang belum ditelaah Auditor.`,
      );
    }

    const changeCount = await this.flow.prisma.auditQuestion.count({
      where: { workspaceId: id, changeFlag: true },
    });
    const submittedCount = await this.flow.prisma.auditQuestion.count({
      where: {
        workspaceId: id,
        reviewStatus: { not: "APPROVED" },
      },
    });

    await this.flow.prisma.$transaction([
      this.flow.prisma.auditQuestion.updateMany({
        where: {
          workspaceId: id,
          reviewStatus: { not: "APPROVED" },
        },
        data: {
          reviewStatus: "PENDING_VERIFICATION",
          verifierNote: null,
        },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: {
          instrumentStatus: "PENDING_VERIFICATION",
          status: "INSTRUMENT_APPROVAL",
          instrumentChangeCount: changeCount,
        },
      }),
    ]);

    await this.flow.notifyRole(
      id,
      "VERIFIER",
      "INSTRUMENT_APPROVAL_REQUESTED",
      "Telaah instrumen menunggu validasi",
      `${submittedCount} butir perlu diperiksa Verifikator; ${changeCount} butir memiliki usulan perubahan.`,
      "AuditWorkspace",
      id,
    );
    await this.flow.log(
      user.id,
      user.username,
      "INSTRUMENT_REVIEW_SUBMITTED",
      "AuditWorkspace",
      id,
      id,
      { note: body.note ?? null, total, submittedCount, changeCount },
    );
    return {
      ok: true,
      total,
      submittedCount,
      changeCount,
      status: "PENDING_VERIFICATION",
    };
  }

  @Post("validate")
  @Roles("VERIFIKATOR")
  async validate(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "PENDING_VERIFICATION",
    ]);

    const [total, approved, invalid, pending] = await Promise.all([
      this.flow.prisma.auditQuestion.count({ where: { workspaceId: id } }),
      this.flow.prisma.auditQuestion.count({
        where: { workspaceId: id, reviewStatus: "APPROVED" },
      }),
      this.flow.prisma.auditQuestion.count({
        where: { workspaceId: id, reviewStatus: "RETURNED" },
      }),
      this.flow.prisma.auditQuestion.count({
        where: { workspaceId: id, reviewStatus: "PENDING_VERIFICATION" },
      }),
    ]);
    if (!total) throw new BadRequestException("Instrumen belum dibentuk.");
    if (pending) {
      throw new BadRequestException(
        `Masih ada ${pending} butir yang belum diberi keputusan Valid atau Tidak Valid.`,
      );
    }
    if (invalid) {
      throw new BadRequestException(
        `${invalid} butir tidak valid. Gunakan tombol Kembalikan ke Ketua Auditor.`,
      );
    }
    if (approved !== total) {
      throw new BadRequestException(
        "Seluruh butir harus berstatus valid sebelum dikirim ke Admin Mutu.",
      );
    }

    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: {
        instrumentStatus: "APPROVED",
        status: "INSTRUMENT_APPROVAL",
      },
    });
    await this.notifyAdminMutu(
      id,
      "Instrumen siap diaktifkan",
      `${workspace.unit.name}: seluruh ${total} butir telah divalidasi Verifikator dan menunggu aktivasi Admin Mutu.`,
    );
    await this.flow.log(
      user.id,
      user.username,
      "INSTRUMENT_REVIEW_VALIDATED",
      "AuditWorkspace",
      id,
      id,
      { note: body.note ?? null, total },
    );
    return { ok: true, status: "APPROVED", total };
  }

  @Post("return-review")
  @Roles("VERIFIKATOR")
  async returnReview(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "PENDING_VERIFICATION",
    ]);

    const [invalid, pending] = await Promise.all([
      this.flow.prisma.auditQuestion.count({
        where: { workspaceId: id, reviewStatus: "RETURNED" },
      }),
      this.flow.prisma.auditQuestion.count({
        where: { workspaceId: id, reviewStatus: "PENDING_VERIFICATION" },
      }),
    ]);
    if (pending) {
      throw new BadRequestException(
        `Masih ada ${pending} butir yang belum diperiksa Verifikator.`,
      );
    }
    if (!invalid) {
      throw new BadRequestException(
        "Tidak ada butir tidak valid. Instrumen tidak dapat dikembalikan.",
      );
    }

    const note = String(body.note ?? "").trim();
    if (!note) {
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    }

    await this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: {
        instrumentStatus: "RETURNED",
        status: "INSTRUMENT_REVIEW",
      },
    });
    await this.flow.notifyRole(
      id,
      "LEAD_AUDITOR",
      "INSTRUMENT_RETURNED",
      `${invalid} butir instrumen dikembalikan`,
      note,
      "AuditWorkspace",
      id,
    );
    await this.flow.log(
      user.id,
      user.username,
      "INSTRUMENT_REVIEW_RETURNED",
      "AuditWorkspace",
      id,
      id,
      { note, invalid },
    );
    return { ok: true, status: "RETURNED", invalid };
  }

  @Post("activate")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async activate(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.instrumentStatus, ["APPROVED"]);
    const result = await this.flow.publishInstrument(
      id,
      user,
      body.note ?? "Instrumen diaktifkan Admin Mutu.",
    );
    await this.notifyAuditee(
      id,
      workspace.unitId,
      "Self-assessment telah dibuka",
      `Instrumen ${workspace.unit.name} telah diaktifkan Admin Mutu dan siap diisi.`,
    );
    return { ...result, status: "PUBLISHED" };
  }
}
