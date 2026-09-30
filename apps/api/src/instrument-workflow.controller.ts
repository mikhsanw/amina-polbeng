import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow")
export class InstrumentWorkflowController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Patch("questions/:id")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async editQuestion(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } } },
    });
    this.flow.requireAssignment(question.workspace, user, [
      "AUDITOR",
      "LEAD_AUDITOR",
    ]);
    this.flow.requireStatus(question.reviewStatus, [
      "AUDITOR_REVIEW",
      "RETURNED",
      "DRAFT",
    ]);

    const proposed = {
      question: String(
        body.auditorQuestion ??
          body.questionSnapshot ??
          question.defaultQuestion,
      ).trim(),
      expectedEvidence:
        body.auditorExpectedEvidence ??
        body.expectedEvidence ??
        question.defaultExpectedEvidence,
      testMethod:
        body.auditorTestMethod ?? body.testMethod ?? question.defaultTestMethod,
      riskLevel:
        body.auditorRiskLevel ?? body.riskLevel ?? question.defaultRiskLevel,
    };
    const defaults = this.flow.questionDefault(question);
    const changeFields = Object.keys(proposed).filter(
      (key) =>
        String((proposed as any)[key] ?? "").trim() !==
        String((defaults as any)[key] ?? "").trim(),
    );
    const changeFlag = changeFields.length > 0 || question.excluded;
    if (
      changeFlag &&
      !String(body.changeReason ?? question.changeReason ?? "").trim()
    ) {
      throw new BadRequestException("Alasan perubahan instrumen wajib diisi.");
    }

    const updated = await this.flow.prisma.auditQuestion.update({
      where: { id },
      data: {
        auditorQuestion: proposed.question,
        auditorExpectedEvidence: proposed.expectedEvidence,
        auditorTestMethod: proposed.testMethod,
        auditorRiskLevel: proposed.riskLevel,
        questionSnapshot: proposed.question,
        changeFlag,
        changeFields,
        changeReason: body.changeReason ?? question.changeReason,
        auditorNote: body.auditorNote,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewStatus: "AUDITOR_REVIEW",
      },
    });
    await this.flow.prisma.auditWorkspace.update({
      where: { id: question.workspaceId },
      data: {
        instrumentChangeCount: await this.flow.prisma.auditQuestion.count({
          where: { workspaceId: question.workspaceId, changeFlag: true },
        }),
      },
    });
    return updated;
  }

  @Delete("questions/:id")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async excludeQuestion(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } } },
    });
    this.flow.requireAssignment(question.workspace, user, [
      "AUDITOR",
      "LEAD_AUDITOR",
    ]);
    this.flow.requireStatus(question.reviewStatus, [
      "AUDITOR_REVIEW",
      "RETURNED",
      "DRAFT",
    ]);
    if (!body?.reason) {
      throw new BadRequestException(
        "Alasan pengecualian pertanyaan wajib diisi.",
      );
    }
    const updated = await this.flow.prisma.auditQuestion.update({
      where: { id },
      data: {
        excluded: true,
        exclusionReason: body.reason,
        changeFlag: true,
        changeFields: ["excluded"],
        changeReason: body.reason,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    await this.flow.prisma.auditWorkspace.update({
      where: { id: question.workspaceId },
      data: {
        instrumentChangeCount: await this.flow.prisma.auditQuestion.count({
          where: { workspaceId: question.workspaceId, changeFlag: true },
        }),
      },
    });
    return updated;
  }

  @Post("questions/:id/include")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async includeQuestion(@Param("id") id: string, @CurrentUser() user: any) {
    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } } },
    });
    this.flow.requireAssignment(question.workspace, user, [
      "AUDITOR",
      "LEAD_AUDITOR",
    ]);
    this.flow.requireStatus(question.reviewStatus, [
      "AUDITOR_REVIEW",
      "RETURNED",
      "DRAFT",
    ]);
    const proposed = {
      question: question.auditorQuestion ?? question.defaultQuestion,
      expectedEvidence:
        question.auditorExpectedEvidence ?? question.defaultExpectedEvidence,
      testMethod: question.auditorTestMethod ?? question.defaultTestMethod,
      riskLevel: question.auditorRiskLevel ?? question.defaultRiskLevel,
    };
    const defaults = this.flow.questionDefault(question);
    const changeFields = Object.keys(proposed).filter(
      (key) =>
        String((proposed as any)[key] ?? "").trim() !==
        String((defaults as any)[key] ?? "").trim(),
    );
    const updated = await this.flow.prisma.auditQuestion.update({
      where: { id },
      data: {
        excluded: false,
        exclusionReason: null,
        changeFlag: changeFields.length > 0,
        changeFields,
        changeReason: changeFields.length ? question.changeReason : null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    await this.flow.prisma.auditWorkspace.update({
      where: { id: question.workspaceId },
      data: {
        instrumentChangeCount: await this.flow.prisma.auditQuestion.count({
          where: { workspaceId: question.workspaceId, changeFlag: true },
        }),
      },
    });
    return updated;
  }

  @Post("workspaces/:id/instrument/submit")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async submit(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "AUDITOR_REVIEW",
      "RETURNED",
      "DRAFT",
    ]);
    const total = await this.flow.prisma.auditQuestion.count({
      where: { workspaceId: id },
    });
    if (!total) throw new BadRequestException("Instrumen belum dibentuk.");
    const changeCount = await this.flow.prisma.auditQuestion.count({
      where: { workspaceId: id, changeFlag: true },
    });

    if (changeCount === 0) {
      if (
        !workspace.team.some(
          (member) =>
            member.userId === user.id && member.role === "LEAD_AUDITOR",
        )
      ) {
        throw new ForbiddenException(
          "Instrumen tanpa perubahan hanya dapat dipublikasikan oleh Ketua Auditor.",
        );
      }
      return this.flow.publishInstrument(
        id,
        user,
        body.note ?? "Tidak ada perubahan instrumen.",
      );
    }

    if (
      !workspace.team.some(
        (member) => member.userId === user.id && member.role === "LEAD_AUDITOR",
      )
    ) {
      throw new ForbiddenException(
        "Usulan perubahan harus diajukan oleh Ketua Auditor.",
      );
    }
    await this.flow.prisma.$transaction([
      this.flow.prisma.auditQuestion.updateMany({
        where: { workspaceId: id, changeFlag: true },
        data: { reviewStatus: "PENDING_VERIFICATION" },
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
      "Perubahan instrumen menunggu verifikasi",
      `${changeCount} butir instrumen diusulkan berubah oleh tim auditor.`,
      "AuditWorkspace",
      id,
    );
    return { ok: true, changeCount };
  }

  @Post("workspaces/:id/instrument/return")
  @Roles("VERIFIKATOR")
  async returnChanges(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "PENDING_VERIFICATION",
    ]);
    if (!body.note)
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    const changed = await this.flow.prisma.auditQuestion.findMany({
      where: { workspaceId: id, changeFlag: true },
    });
    await this.flow.prisma.$transaction([
      ...changed.map((question) =>
        this.flow.prisma.instrumentChangeReview.create({
          data: {
            workspaceId: id,
            auditQuestionId: question.id,
            verifierUserId: user.id,
            decision: "RETURN",
            note: body.note,
            beforeValue: this.flow.questionDefault(question),
            proposedValue: this.flow.questionProposal(question),
          },
        }),
      ),
      this.flow.prisma.auditQuestion.updateMany({
        where: { workspaceId: id, changeFlag: true },
        data: { reviewStatus: "RETURNED", verifierNote: body.note },
      }),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { instrumentStatus: "RETURNED", status: "INSTRUMENT_REVIEW" },
      }),
    ]);
    await this.flow.notifyRole(
      id,
      "LEAD_AUDITOR",
      "INSTRUMENT_RETURNED",
      "Perubahan instrumen dikembalikan",
      body.note,
      "AuditWorkspace",
      id,
    );
    return { ok: true };
  }

  @Post("workspaces/:id/instrument/reject")
  @Roles("VERIFIKATOR")
  async rejectChanges(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "PENDING_VERIFICATION",
    ]);
    if (!body.note)
      throw new BadRequestException("Alasan penolakan wajib diisi.");
    const changed = await this.flow.prisma.auditQuestion.findMany({
      where: { workspaceId: id, changeFlag: true },
    });
    await this.flow.prisma.$transaction([
      ...changed.map((question) =>
        this.flow.prisma.instrumentChangeReview.create({
          data: {
            workspaceId: id,
            auditQuestionId: question.id,
            verifierUserId: user.id,
            decision: "REJECT",
            note: body.note,
            beforeValue: this.flow.questionDefault(question),
            proposedValue: this.flow.questionProposal(question),
          },
        }),
      ),
      ...changed.map((question) =>
        this.flow.prisma.auditQuestion.update({
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
            reviewStatus: "APPROVED",
            verifierNote: body.note,
          },
        }),
      ),
      this.flow.prisma.auditWorkspace.update({
        where: { id },
        data: { instrumentChangeCount: 0 },
      }),
    ]);
    return this.flow.publishInstrument(
      id,
      user,
      `Usulan perubahan ditolak: ${body.note}`,
    );
  }

  @Post("workspaces/:id/instrument/approve")
  @Roles("VERIFIKATOR")
  async approveChanges(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireAssignment(workspace, user, ["VERIFIER"]);
    this.flow.requireStatus(workspace.instrumentStatus, [
      "PENDING_VERIFICATION",
    ]);
    const changed = await this.flow.prisma.auditQuestion.findMany({
      where: { workspaceId: id, changeFlag: true },
    });
    if (!changed.length)
      throw new BadRequestException("Tidak ada perubahan untuk diverifikasi.");
    await this.flow.prisma.$transaction(
      changed.map((question) =>
        this.flow.prisma.instrumentChangeReview.create({
          data: {
            workspaceId: id,
            auditQuestionId: question.id,
            verifierUserId: user.id,
            decision: "APPROVE",
            note: body.note,
            beforeValue: this.flow.questionDefault(question),
            proposedValue: this.flow.questionProposal(question),
          },
        }),
      ),
    );
    return this.flow.publishInstrument(
      id,
      user,
      body.note ?? "Perubahan instrumen disetujui.",
    );
  }
}
