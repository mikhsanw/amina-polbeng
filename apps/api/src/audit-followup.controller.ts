import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { join } from "node:path";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow")
export class AuditFollowupController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Post("findings/:id/corrective-actions")
  @Roles("AUDITEE")
  async createAction(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const finding = await this.flow.prisma.finding.findUniqueOrThrow({
      where: { id },
      include: { workspace: true },
    });
    if (finding.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(finding.status, [
      "OPEN",
      "CAPA_REVIEW",
      "IMPLEMENTATION",
    ]);
    for (const [field, label] of [
      ["correction", "Koreksi langsung"],
      ["rootCauseStatement", "Akar masalah"],
      ["correctiveAction", "Tindakan korektif"],
      ["successIndicator", "Indikator keberhasilan"],
      ["targetDate", "Target penyelesaian"],
    ]) {
      if (!String(body[field] ?? "").trim()) {
        throw new BadRequestException(`${label} wajib diisi.`);
      }
    }
    const targetDate = new Date(body.targetDate);
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException("Target penyelesaian tidak valid.");
    }
    const action = await this.flow.prisma.correctiveAction.create({
      data: {
        correction: body.correction,
        analysisMethod: body.analysisMethod,
        rootCauseStatement: body.rootCauseStatement,
        correctiveAction: body.correctiveAction,
        successIndicator: body.successIndicator,
        picUserId: body.picUserId || null,
        targetDate,
        findingId: id,
        workspaceId: finding.workspaceId,
        status: user.isUnitApprover ? "APPROVED" : "SUBMITTED",
      },
    });
    await this.flow.prisma.finding.update({
      where: { id },
      data: { status: user.isUnitApprover ? "IMPLEMENTATION" : "CAPA_REVIEW" },
    });
    return action;
  }

  @Patch("actions/:id")
  @Roles("AUDITEE")
  async updateAction(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: true },
    });
    if (action.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(action.status, ["DRAFT", "SUBMITTED", "RETURNED"]);
    const targetDate = body.targetDate
      ? new Date(body.targetDate)
      : action.targetDate;
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException("Target penyelesaian tidak valid.");
    }
    const status = user.isUnitApprover ? "APPROVED" : "SUBMITTED";
    const updated = await this.flow.prisma.correctiveAction.update({
      where: { id },
      data: {
        correction: body.correction ?? action.correction,
        analysisMethod: body.analysisMethod ?? action.analysisMethod,
        rootCauseStatement:
          body.rootCauseStatement ?? action.rootCauseStatement,
        correctiveAction: body.correctiveAction ?? action.correctiveAction,
        successIndicator: body.successIndicator ?? action.successIndicator,
        picUserId:
          body.picUserId === "" ? null : (body.picUserId ?? action.picUserId),
        targetDate,
        status,
      },
    });
    await this.flow.prisma.finding.update({
      where: { id: action.findingId },
      data: { status: user.isUnitApprover ? "IMPLEMENTATION" : "CAPA_REVIEW" },
    });
    return updated;
  }

  @Post("actions/:id/approve")
  @Roles("AUDITEE")
  async approveAction(@Param("id") id: string, @CurrentUser() user: any) {
    if (!user.isUnitApprover) {
      throw new ForbiddenException("Akun Auditee ini bukan pengesah unit.");
    }
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: true },
    });
    if (action.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan pengesah unit target.");
    }
    this.flow.requireStatus(action.status, ["SUBMITTED"]);
    const updated = await this.flow.prisma.correctiveAction.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    await this.flow.prisma.finding.update({
      where: { id: action.findingId },
      data: { status: "IMPLEMENTATION" },
    });
    return updated;
  }

  @Post("actions/:id/return")
  @Roles("AUDITEE")
  async returnAction(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!user.isUnitApprover) {
      throw new ForbiddenException("Akun Auditee ini bukan pengesah unit.");
    }
    if (!String(body.note ?? "").trim()) {
      throw new BadRequestException("Catatan pengembalian wajib diisi.");
    }
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: true },
    });
    if (action.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan pengesah unit target.");
    }
    this.flow.requireStatus(action.status, ["SUBMITTED"]);
    const updated = await this.flow.prisma.correctiveAction.update({
      where: { id },
      data: {
        status: "RETURNED",
        progressNote: String(body.note).trim(),
      },
    });
    await this.flow.prisma.finding.update({
      where: { id: action.findingId },
      data: { status: "CAPA_REVIEW" },
    });
    return updated;
  }

  @Post("actions/:id/progress")
  @Roles("AUDITEE")
  async updateProgress(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: true },
    });
    if (action.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(action.status, ["APPROVED", "IN_PROGRESS"]);
    const progress = Number(body.progressPercent);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      throw new BadRequestException("Progres harus berada pada rentang 0–100.");
    }
    const updated = await this.flow.prisma.correctiveAction.update({
      where: { id },
      data: {
        progressPercent: progress,
        progressNote: body.progressNote,
        status: progress === 100 ? "READY_VERIFY" : "IN_PROGRESS",
      },
    });
    await this.flow.prisma.finding.update({
      where: { id: action.findingId },
      data: { status: progress === 100 ? "VERIFICATION" : "IMPLEMENTATION" },
    });
    return updated;
  }

  @Post("actions/:id/recommendation")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async recommendEffectiveness(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } } },
    });
    this.flow.requireAssignment(action.workspace, user, [
      "AUDITOR",
      "LEAD_AUDITOR",
    ]);
    this.flow.requireStatus(action.status, ["READY_VERIFY"]);
    if (
      !String(body.implementationResult ?? "").trim() ||
      !String(body.effectivenessResult ?? "").trim()
    ) {
      throw new BadRequestException(
        "Hasil pemeriksaan dan rekomendasi efektivitas wajib diisi.",
      );
    }
    if (
      !["EFFECTIVE", "EFFECTIVE_WITH_MONITORING", "NOT_EFFECTIVE"].includes(
        body.status,
      )
    ) {
      throw new BadRequestException(
        "Status rekomendasi efektivitas tidak valid.",
      );
    }
    const existing = await this.flow.prisma.verification.findFirst({
      where: { actionId: id, decidedAt: null },
      orderBy: { verificationDate: "desc" },
    });
    const data: any = {
      verifierUserId: user.id,
      auditorUserId: user.id,
      implementationResult: body.implementationResult,
      effectivenessResult: body.effectivenessResult,
      status: body.status,
      nextReviewDate: body.nextReviewDate
        ? new Date(body.nextReviewDate)
        : null,
    };
    return existing
      ? this.flow.prisma.verification.update({
          where: { id: existing.id },
          data,
        })
      : this.flow.prisma.verification.create({
          data: { actionId: id, ...data },
        });
  }

  @Post("actions/:id/verify")
  @Roles("KETUA_AUDITOR")
  async decideEffectiveness(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } } },
    });
    this.flow.requireAssignment(action.workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(action.status, ["READY_VERIFY"]);
    const recommendation = await this.flow.prisma.verification.findFirst({
      where: { actionId: id, auditorUserId: { not: null } },
      orderBy: { verificationDate: "desc" },
    });
    if (!recommendation && !body.implementationResult) {
      throw new BadRequestException(
        "Auditor belum memberikan rekomendasi verifikasi tindak lanjut.",
      );
    }
    const status = body.status ?? recommendation?.status;
    if (!status)
      throw new BadRequestException("Keputusan efektivitas wajib dipilih.");
    if (
      !["EFFECTIVE", "EFFECTIVE_WITH_MONITORING", "NOT_EFFECTIVE"].includes(
        status,
      )
    ) {
      throw new BadRequestException("Keputusan efektivitas tidak valid.");
    }
    const effective = status !== "NOT_EFFECTIVE";
    const verification = recommendation
      ? await this.flow.prisma.verification.update({
          where: { id: recommendation.id },
          data: {
            leadAuditorUserId: user.id,
            implementationResult:
              body.implementationResult ?? recommendation.implementationResult,
            effectivenessResult:
              body.effectivenessResult ?? recommendation.effectivenessResult,
            status,
            nextReviewDate: body.nextReviewDate
              ? new Date(body.nextReviewDate)
              : recommendation.nextReviewDate,
            decidedAt: new Date(),
            closedAt: status === "EFFECTIVE" ? new Date() : null,
          },
        })
      : await this.flow.prisma.verification.create({
          data: {
            actionId: id,
            verifierUserId: user.id,
            leadAuditorUserId: user.id,
            implementationResult: body.implementationResult,
            effectivenessResult: body.effectivenessResult,
            status,
            nextReviewDate: body.nextReviewDate
              ? new Date(body.nextReviewDate)
              : null,
            decidedAt: new Date(),
            closedAt: status === "EFFECTIVE" ? new Date() : null,
          },
        });
    await this.flow.prisma.correctiveAction.update({
      where: { id },
      data: { status: effective ? "EFFECTIVE" : "NOT_EFFECTIVE" },
    });
    await this.flow.prisma.finding.update({
      where: { id: action.findingId },
      data: { status: effective ? "CLOSED" : "IMPLEMENTATION" },
    });
    return verification;
  }

  @Delete("actions/:id")
  @Roles("AUDITEE")
  async deleteAction(@Param("id") id: string, @CurrentUser() user: any) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { verifications: true, workspace: true },
    });
    if (action.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(action.status, [
      "DRAFT",
      "SUBMITTED",
      "RETURNED",
      "IN_PROGRESS",
    ]);
    if (action.verifications.length) {
      throw new BadRequestException("Tindak lanjut telah diverifikasi.");
    }
    await this.flow.prisma.correctiveAction.delete({ where: { id } });
    return { ok: true };
  }

  @Post("workspaces/:id/close")
  @Roles("ADMIN_MUTU")
  async closeWorkspace(@Param("id") id: string, @CurrentUser() user: any) {
    await this.flow.workspace(id, user);
    const openFindings = await this.flow.prisma.finding.count({
      where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
    });
    if (openFindings) {
      throw new BadRequestException(`${openFindings} temuan belum ditutup.`);
    }
    return this.flow.prisma.auditWorkspace.update({
      where: { id },
      data: { status: "CLOSED" },
    });
  }

  @Post("workspaces/:id/print")
  async registerPrint(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    const type = body.type || "AUDIT_REPORT";
    const version =
      (await this.flow.prisma.printDocument.count({
        where: { workspaceId: id, type },
      })) + 1;
    const fileName = `${type}_${workspace.unit.slug}_${workspace.auditYear}_v${version}.pdf`;
    return this.flow.prisma.printDocument.create({
      data: {
        workspaceId: id,
        type,
        fileName,
        version,
        storageKey: join(
          "storage",
          "audits",
          String(workspace.auditYear),
          workspace.name,
          "print",
          fileName,
        ),
        status: "DRAFT",
      },
    });
  }

  @Get("notifications")
  notifications(@CurrentUser() user: any) {
    return this.flow.prisma.notification.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Get("activity-logs")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN")
  logs() {
    return this.flow.prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
}

/**
 * Direct read routes retained for menu pages that are not inside a workspace.
 * The same data also remains available under /audit-flow for workspace clients.
 */
@Controller()
export class AuditSystemQueryController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Get("notifications")
  notifications(@CurrentUser() user: any) {
    return this.flow.prisma.notification.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Get("activity-logs")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN")
  logs() {
    return this.flow.prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
}
