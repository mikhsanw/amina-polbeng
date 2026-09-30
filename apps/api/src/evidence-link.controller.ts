import { BadRequestException, Body, Controller, Param, Post } from "@nestjs/common";
import { createHash } from "node:crypto";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";

function googleDriveUrl(value: unknown) {
  let url: URL;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw new BadRequestException("Link Google Drive tidak valid.");
  }
  if (url.protocol !== "https:") {
    throw new BadRequestException("Link bukti harus menggunakan HTTPS.");
  }
  const host = url.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") {
    throw new BadRequestException(
      "Link bukti hanya menerima Google Drive atau Google Docs.",
    );
  }
  return url.toString();
}

@Controller("audit-flow")
export class EvidenceLinkController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly schedule: AuditScheduleService,
  ) {}

  @Post("workspaces/:id/assessment-evidences/link")
  @Roles("AUDITEE")
  async createLink(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const workspace = await this.flow.workspace(id, user);
    if (workspace.unitId !== user.unitId) {
      throw new BadRequestException("Bukan Auditee unit target.");
    }

    const auditQuestionId = String(body.auditQuestionId ?? "").trim();
    const title = String(body.title ?? "").trim();
    if (!auditQuestionId) {
      throw new BadRequestException("Pertanyaan audit untuk link bukti wajib dipilih.");
    }
    if (!title) {
      throw new BadRequestException("Nama file atau dokumen wajib diisi.");
    }
    const url = googleDriveUrl(body.url);

    const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
      where: { id: auditQuestionId },
      include: { assessment: true },
    });
    if (question.workspaceId !== id || question.excluded) {
      throw new BadRequestException(
        "Pertanyaan bukti tidak berasal dari workspace ini.",
      );
    }

    if (workspace.status === "SELF_ASSESSMENT") {
      await this.schedule.requireOpen(id, "SELF_ASSESSMENT");
    } else if (workspace.status === "FIELD_AUDIT") {
      await this.schedule.requireOpen(id, "FIELD_AUDIT");
      if (
        !["RETURNED", "OPEN", "IN_PROGRESS", "FIELD_PENDING"].includes(
          question.assessment?.responseStatus || "",
        )
      ) {
        throw new BadRequestException(
          "Link bukti perbaikan hanya dapat ditambahkan pada butir yang masih dapat diperbaiki.",
        );
      }
    } else {
      throw new BadRequestException(
        "Penambahan link bukti tidak tersedia pada tahap audit saat ini.",
      );
    }

    const count = await this.flow.prisma.evidence.count();
    const evidence = await this.flow.prisma.evidence.create({
      data: {
        code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
        workspaceId: id,
        auditQuestionId,
        evidenceType: "LINK",
        title,
        description: String(body.description ?? "").trim() || null,
        fileName: title,
        mimeType: "text/uri-list",
        fileSizeBytes: 0,
        storageKey: url,
        checksum: createHash("sha256").update(url).digest("hex"),
        uploadedById: user.id,
        confidentiality: body.confidentiality || "INTERNAL",
      },
    });

    await this.flow.log(
      user.id,
      user.username,
      "ASSESSMENT_EVIDENCE_LINK_ADDED",
      "Evidence",
      evidence.id,
      id,
      { auditQuestionId, title, url },
    );
    return evidence;
  }
}
