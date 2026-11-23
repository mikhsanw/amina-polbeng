import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

export const CAPA_EVIDENCE_MARKER = "CAPA_EVIDENCE:";

function text(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new BadRequestException(`${label} wajib diisi.`);
  return result;
}

const CAPA_OPEN_WORKSPACE_STATUSES = ["FOLLOW_UP", "REPORT_REVIEW"];

function capaPayload(body: any) {
  const targetDate = new Date(text(body.targetDate, "Target penyelesaian"));
  if (Number.isNaN(targetDate.getTime())) {
    throw new BadRequestException("Target penyelesaian tidak valid.");
  }
  return {
    correction: text(body.correction, "Koreksi langsung"),
    analysisMethod: text(body.analysisMethod || "FIVE_WHY", "Metode analisis"),
    rootCauseStatement: text(body.rootCauseStatement, "Akar masalah"),
    correctiveAction: text(body.correctiveAction, "Tindakan korektif"),
    successIndicator: text(body.successIndicator, "Indikator keberhasilan"),
    targetDate,
  };
}

function capaLinkData(
  action: { id: string; workspaceId: string },
  auditQuestionId: string | null,
  evidenceTitle: string,
  evidenceUrl: string,
  userId: string,
) {
  return {
    code: `CAPA-LINK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: action.workspaceId,
    auditQuestionId,
    evidenceType: "LINK" as const,
    title: evidenceTitle,
    description: `${CAPA_EVIDENCE_MARKER}${action.id}`,
    fileName: evidenceTitle,
    mimeType: "text/uri-list",
    fileSizeBytes: 0,
    storageKey: evidenceUrl,
    checksum: createHash("sha256").update(evidenceUrl).digest("hex"),
    confidentiality: "INTERNAL" as const,
    reviewStatus: "PENDING" as const,
    uploadedById: userId,
  };
}

function httpsUrl(value: unknown) {
  const raw = text(value, "Link bukti CAPA");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException("Link bukti CAPA tidak valid.");
  }
  if (parsed.protocol !== "https:") {
    throw new BadRequestException("Link bukti CAPA wajib menggunakan HTTPS.");
  }
  return parsed.toString();
}

@Controller("audit-flow")
export class CapaVerificationController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  /**
   * CAPA yang sudah dikirim masih boleh diubah, dikurangi link buktinya, atau
   * ditarik oleh Auditee selama: workspace dalam tahap tindak lanjut, batas
   * "CAPA dan tindak lanjut" belum lewat, dan Auditor belum memberi rekomendasi.
   */
  private async editableCapa(actionId: string, user: any) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id: actionId },
      include: { workspace: true, finding: true, verifications: true },
    });
    if (action.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(action.workspace.status, CAPA_OPEN_WORKSPACE_STATUSES);
    if (action.status !== "READY_VERIFY") {
      throw new BadRequestException("CAPA ini tidak sedang menunggu verifikasi.");
    }
    if (action.verifications.some((item) => !item.decidedAt)) {
      throw new BadRequestException(
        "Auditor sudah memberi rekomendasi, CAPA tidak dapat diubah lagi.",
      );
    }
    await this.schedule.requireOpen(action.workspaceId, "FOLLOW_UP");
    return action;
  }

  private async capaLinks(actionId: string) {
    return this.flow.prisma.evidence.findMany({
      where: {
        deletedAt: null,
        description: `${CAPA_EVIDENCE_MARKER}${actionId}`,
      },
      select: { id: true },
    });
  }

  @Get("workspaces/:id/capa-flow")
  async flowDetail(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const [findings, evidences] = await Promise.all([
      this.flow.prisma.finding.findMany({
        where: { workspaceId: id },
        include: {
          question: {
            select: {
              id: true,
              publishedQuestion: true,
              questionSnapshot: true,
            },
          },
          actions: {
            include: { verifications: { orderBy: { verificationDate: "desc" } } },
            orderBy: { updatedAt: "desc" },
          },
        },
        orderBy: { code: "asc" },
      }),
      this.flow.prisma.evidence.findMany({
        where: {
          workspaceId: id,
          deletedAt: null,
          description: { startsWith: CAPA_EVIDENCE_MARKER },
        },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { uploadedAt: "desc" },
      }),
    ]);

    const evidenceByAction = new Map<string, any[]>();
    for (const evidence of evidences) {
      const actionId = String(evidence.description || "").slice(
        CAPA_EVIDENCE_MARKER.length,
      );
      const list = evidenceByAction.get(actionId) || [];
      list.push(evidence);
      evidenceByAction.set(actionId, list);
    }

    const window = await this.schedule.state(id, "FOLLOW_UP");
    return {
      workspace,
      capaWindow: { open: window.open, deadline: window.deadline },
      findings: findings.map((finding) => ({
        ...finding,
        actions: finding.actions.map((action) => ({
          ...action,
          evidences: evidenceByAction.get(action.id) || [],
        })),
      })),
    };
  }

  @Post("findings/:id/capa-submit")
  @Roles("AUDITEE")
  async submitCapa(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const finding = await this.flow.prisma.finding.findUniqueOrThrow({
      where: { id },
      include: {
        workspace: true,
        actions: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });
    if (finding.workspace.unitId !== user.unitId) {
      throw new ForbiddenException("Bukan Auditee unit target.");
    }
    this.flow.requireStatus(finding.workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
    this.flow.requireStatus(finding.status, [
      "OPEN",
      "CAPA_REVIEW",
      "IMPLEMENTATION",
      "VERIFICATION",
    ]);

    const payload = capaPayload(body);
    const targetDate = payload.targetDate;
    const evidenceTitle = text(body.evidenceTitle, "Nama dokumen bukti CAPA");
    const evidenceUrl = httpsUrl(body.evidenceUrl);
    const previous = finding.actions[0];

    const result = await this.flow.prisma.$transaction(async (tx) => {
      const action = previous && previous.status !== "EFFECTIVE"
        ? await tx.correctiveAction.update({
            where: { id: previous.id },
            data: {
              ...payload,
              progressPercent: 100,
              progressNote: String(body.progressNote || "CAPA dikirim untuk verifikasi.").trim(),
              status: "READY_VERIFY",
            },
          })
        : await tx.correctiveAction.create({
            data: {
              ...payload,
              findingId: id,
              workspaceId: finding.workspaceId,
              progressPercent: 100,
              progressNote: String(body.progressNote || "CAPA dikirim untuk verifikasi.").trim(),
              status: "READY_VERIFY",
            },
          });

      const evidence = await tx.evidence.create({
        data: capaLinkData(
          action,
          finding.auditQuestionId,
          evidenceTitle,
          evidenceUrl,
          user.id,
        ),
      });

      await tx.finding.update({ where: { id }, data: { status: "VERIFICATION" } });
      return { action, evidence };
    });

    for (const role of ["AUDITOR", "LEAD_AUDITOR"]) {
      await this.flow.notifyRole(
        finding.workspaceId,
        role,
        "VERIFICATION_REQUESTED",
        "CAPA siap diverifikasi",
        `${finding.code}: Auditee mengirim CAPA dan link bukti pelaksanaan.`,
        "CorrectiveAction",
        result.action.id,
      );
    }
    await this.flow.log(
      user.id,
      user.username,
      "CAPA_SUBMITTED_FOR_VERIFICATION",
      "CorrectiveAction",
      result.action.id,
      finding.workspaceId,
      {
        findingCode: finding.code,
        evidenceTitle,
        evidenceUrl,
        targetDate: targetDate.toISOString(),
      },
    );
    return result;
  }

  @Post("actions/:id/capa-update")
  @Roles("AUDITEE")
  async updateCapa(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.editableCapa(id, user);
    const payload = capaPayload(body);
    const wantsLink = String(body.evidenceUrl ?? "").trim() !== "";
    const evidenceTitle = wantsLink
      ? text(body.evidenceTitle, "Nama dokumen bukti CAPA")
      : "";
    const evidenceUrl = wantsLink ? httpsUrl(body.evidenceUrl) : "";

    const updated = await this.flow.prisma.$transaction(async (tx) => {
      const result = await tx.correctiveAction.update({
        where: { id },
        data: {
          ...payload,
          progressNote: String(body.progressNote ?? action.progressNote ?? "").trim() || null,
        },
      });
      if (wantsLink) {
        await tx.evidence.create({
          data: capaLinkData(
            action,
            action.finding.auditQuestionId,
            evidenceTitle,
            evidenceUrl,
            user.id,
          ),
        });
      }
      return result;
    });

    await this.flow.log(
      user.id,
      user.username,
      "CAPA_UPDATED",
      "CorrectiveAction",
      id,
      action.workspaceId,
      {
        findingCode: action.finding.code,
        targetDate: payload.targetDate.toISOString(),
        ...(wantsLink ? { evidenceTitle, evidenceUrl } : {}),
      },
    );
    return updated;
  }

  @Delete("capa-evidences/:id")
  @Roles("AUDITEE")
  async deleteCapaEvidence(@Param("id") id: string, @CurrentUser() user: any) {
    const evidence = await this.flow.prisma.evidence.findUniqueOrThrow({
      where: { id },
    });
    const description = String(evidence.description || "");
    if (!description.startsWith(CAPA_EVIDENCE_MARKER) || evidence.deletedAt) {
      throw new BadRequestException("Link bukti CAPA tidak ditemukan.");
    }
    const actionId = description.slice(CAPA_EVIDENCE_MARKER.length);
    const action = await this.editableCapa(actionId, user);
    const links = await this.capaLinks(actionId);
    if (links.length <= 1) {
      throw new BadRequestException(
        "CAPA wajib memiliki minimal satu link bukti. Tambahkan link baru dulu, atau tarik CAPA.",
      );
    }
    await this.flow.prisma.evidence.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.flow.log(
      user.id,
      user.username,
      "CAPA_EVIDENCE_DELETED",
      "Evidence",
      id,
      action.workspaceId,
      {
        findingCode: action.finding.code,
        evidenceTitle: evidence.title,
        evidenceUrl: evidence.storageKey,
      },
    );
    return { ok: true };
  }

  @Post("actions/:id/capa-withdraw")
  @Roles("AUDITEE")
  async withdrawCapa(@Param("id") id: string, @CurrentUser() user: any) {
    const action = await this.editableCapa(id, user);
    const links = await this.capaLinks(id);
    const firstCycle = action.verifications.length === 0;

    await this.flow.prisma.$transaction(async (tx) => {
      if (links.length) {
        await tx.evidence.updateMany({
          where: { id: { in: links.map((link) => link.id) } },
          data: { deletedAt: new Date() },
        });
      }
      if (firstCycle) {
        // Belum pernah diverifikasi: CAPA dihapus dan temuan kembali Open.
        await tx.correctiveAction.delete({ where: { id } });
        await tx.finding.update({
          where: { id: action.findingId },
          data: { status: "OPEN" },
        });
      } else {
        // Sudah punya riwayat verifikasi: riwayat dipertahankan, CAPA kembali
        // ke status "Tetap Open" agar Auditee dapat mengirim ulang.
        await tx.correctiveAction.update({
          where: { id },
          data: { status: "NOT_EFFECTIVE" },
        });
        await tx.finding.update({
          where: { id: action.findingId },
          data: { status: "IMPLEMENTATION" },
        });
      }
    });

    await this.flow.log(
      user.id,
      user.username,
      "CAPA_WITHDRAWN",
      "CorrectiveAction",
      id,
      action.workspaceId,
      { findingCode: action.finding.code, deletedAction: firstCycle },
    );
    return { ok: true, deleted: firstCycle };
  }

  @Post("actions/:id/auditor-verification")
  @Roles("AUDITOR", "KETUA_AUDITOR")
  async auditorVerification(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } }, finding: true },
    });
    this.flow.requireAssignment(action.workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
    this.flow.requireStatus(action.status, ["READY_VERIFY"]);

    const decision = String(body.decision || "").trim().toUpperCase();
    if (!["CLOSE", "OPEN"].includes(decision)) {
      throw new BadRequestException("Pilih rekomendasi Close atau Tetap Open.");
    }
    const implementationResult = text(
      body.implementationResult,
      "Hasil pemeriksaan implementasi",
    );
    const effectivenessResult = text(
      body.effectivenessResult,
      "Catatan rekomendasi Auditor",
    );
    const status = decision === "CLOSE" ? "EFFECTIVE" : "NOT_EFFECTIVE";
    const existing = await this.flow.prisma.verification.findFirst({
      where: { actionId: id, decidedAt: null },
      orderBy: { verificationDate: "desc" },
    });
    const verification = existing
      ? await this.flow.prisma.verification.update({
          where: { id: existing.id },
          data: {
            verifierUserId: user.id,
            auditorUserId: user.id,
            implementationResult,
            effectivenessResult,
            status,
            nextReviewDate: body.nextReviewDate
              ? new Date(body.nextReviewDate)
              : null,
          },
        })
      : await this.flow.prisma.verification.create({
          data: {
            actionId: id,
            verifierUserId: user.id,
            auditorUserId: user.id,
            implementationResult,
            effectivenessResult,
            status,
            nextReviewDate: body.nextReviewDate
              ? new Date(body.nextReviewDate)
              : null,
          },
        });

    await this.flow.notifyRole(
      action.workspaceId,
      "LEAD_AUDITOR",
      "VERIFICATION_REQUESTED",
      "Rekomendasi verifikasi CAPA menunggu keputusan",
      `${action.finding.code}: Auditor merekomendasikan ${decision === "CLOSE" ? "Close" : "Tetap Open"}.`,
      "Verification",
      verification.id,
    );
    await this.flow.log(
      user.id,
      user.username,
      "CAPA_AUDITOR_RECOMMENDATION",
      "Verification",
      verification.id,
      action.workspaceId,
      { findingCode: action.finding.code, decision, implementationResult, effectivenessResult },
    );
    return verification;
  }

  @Post("actions/:id/lead-verification")
  @Roles("KETUA_AUDITOR")
  async leadVerification(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
      where: { id },
      include: { workspace: { include: { team: true } }, finding: true },
    });
    this.flow.requireAssignment(action.workspace, user, ["LEAD_AUDITOR"]);
    this.flow.requireStatus(action.status, ["READY_VERIFY"]);
    const recommendation = await this.flow.prisma.verification.findFirst({
      where: { actionId: id, auditorUserId: { not: null }, decidedAt: null },
      orderBy: { verificationDate: "desc" },
    });
    if (!recommendation) {
      throw new BadRequestException("Auditor belum memberikan rekomendasi Close atau Open.");
    }

    const decision = String(body.decision || "").trim().toUpperCase();
    if (!["CLOSE", "OPEN"].includes(decision)) {
      throw new BadRequestException("Pilih keputusan final Close atau Tetap Open.");
    }
    const note = text(body.note, "Catatan keputusan Ketua Auditor");
    const close = decision === "CLOSE";
    const now = new Date();

    const verification = await this.flow.prisma.$transaction(async (tx) => {
      const saved = await tx.verification.update({
        where: { id: recommendation.id },
        data: {
          leadAuditorUserId: user.id,
          effectivenessResult: note,
          status: close ? "EFFECTIVE" : "NOT_EFFECTIVE",
          decidedAt: now,
          closedAt: close ? now : null,
        },
      });
      await tx.correctiveAction.update({
        where: { id },
        data: {
          status: close ? "EFFECTIVE" : "IN_PROGRESS",
          progressPercent: close ? 100 : action.progressPercent,
          progressNote: note,
        },
      });
      await tx.finding.update({
        where: { id: action.findingId },
        data: { status: close ? "CLOSED" : "IMPLEMENTATION" },
      });
      return saved;
    });

    const auditees = await this.flow.prisma.user.findMany({
      where: {
        unitId: action.workspace.unitId,
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: "AUDITEE" } } },
      },
      select: { id: true },
    });
    if (auditees.length) {
      await this.flow.prisma.notification.createMany({
        data: auditees.map((auditee) => ({
          workspaceId: action.workspaceId,
          recipientUserId: auditee.id,
          event: close ? "FINDING_CLOSED" : "ACTION_RETURNED",
          title: close ? "Temuan ditutup" : "Temuan tetap Open",
          message: `${action.finding.code}: ${note}`,
          entityType: "Finding",
          entityId: action.findingId,
        })),
      });
    }
    await this.flow.log(
      user.id,
      user.username,
      close ? "CAPA_LEAD_DECISION_CLOSE" : "CAPA_LEAD_DECISION_OPEN",
      "Verification",
      verification.id,
      action.workspaceId,
      { findingCode: action.finding.code, decision, note },
    );
    return verification;
  }
}
