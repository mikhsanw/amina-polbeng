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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { CurrentUser, Roles } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

export const SIGNED_ARCHIVE_MARKER = "AUDIT_ARCHIVE_SIGNED_REPORT";

@Controller("audit-flow")
export class AuditArchiveController {
  constructor(private readonly flow: AmiWorkflowService) {}

  private requireUploader(workspace: any, user: any) {
    if (this.flow.hasRole(user, ["SUPER_ADMIN", "ADMIN_MUTU"])) return;
    this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
  }

  @Get("workspaces/:id/archive")
  async list(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const [documents, openFindings, reportCount] = await Promise.all([
      this.flow.prisma.evidence.findMany({
        where: {
          workspaceId: id,
          auditQuestionId: null,
          description: SIGNED_ARCHIVE_MARKER,
          deletedAt: null,
        },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { uploadedAt: "desc" },
      }),
      this.flow.prisma.finding.count({
        where: { workspaceId: id, status: { notIn: ["CLOSED", "VOID"] } },
      }),
      this.flow.prisma.printDocument.count({
        where: { workspaceId: id, type: "AUDIT_REPORT" },
      }),
    ]);
    return { workspace, documents, openFindings, reportCount };
  }

  @Post("workspaces/:id/archive/upload")
  @Roles("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Param("id") id: string,
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException("Dokumen arsip wajib dipilih.");
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
    this.requireUploader(workspace, user);

    const reportCount = await this.flow.prisma.printDocument.count({
      where: { workspaceId: id, type: "AUDIT_REPORT" },
    });
    if (!reportCount) {
      throw new BadRequestException(
        "Buat dan unduh minimal satu versi laporan PDF sebelum mengunggah dokumen bertanda tangan ke Archive.",
      );
    }

    const extension = extname(String(file.originalname || "")).toLowerCase();
    if (file.mimetype !== "application/pdf" && extension !== ".pdf") {
      throw new BadRequestException(
        "Dokumen arsip bertanda tangan harus dalam format PDF.",
      );
    }
    const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
    if (!file.buffer?.length || file.buffer.length > maxBytes) {
      throw new BadRequestException(
        `Ukuran PDF maksimal ${process.env.MAX_UPLOAD_MB ?? 20} MB.`,
      );
    }

    const directory = join(
      process.cwd(),
      "storage",
      "audits",
      String(workspace.auditYear),
      workspace.name,
      "archive",
    );
    await mkdir(directory, { recursive: true });
    const safeName = `${Date.now()}-${String(file.originalname).replace(/[^\w.-]/g, "_")}`;
    await writeFile(join(directory, safeName), file.buffer);

    const document = await this.flow.prisma.evidence.create({
      data: {
        code: `ARC-${workspace.auditYear}-${Date.now()}`,
        workspaceId: id,
        auditQuestionId: null,
        evidenceType: "REPORT",
        title: String(body.title || "Laporan AMI Bertanda Tangan").trim(),
        description: SIGNED_ARCHIVE_MARKER,
        fileName: file.originalname,
        mimeType: "application/pdf",
        fileSizeBytes: file.buffer.length,
        storageKey: join(
          "storage",
          "audits",
          String(workspace.auditYear),
          workspace.name,
          "archive",
          safeName,
        ),
        checksum: createHash("sha256").update(file.buffer).digest("hex"),
        confidentiality: "INTERNAL",
        reviewStatus: "PENDING",
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
    });

    await this.flow.log(
      user.id,
      user.username,
      "SIGNED_AUDIT_ARCHIVE_UPLOADED",
      "Evidence",
      document.id,
      id,
      { fileName: document.fileName, title: document.title },
    );
    return document;
  }

  @Patch("archive-documents/:id/review")
  @Roles("ADMIN_MUTU", "SUPER_ADMIN")
  async review(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const document = await this.flow.prisma.evidence.findFirst({
      where: {
        id,
        auditQuestionId: null,
        description: SIGNED_ARCHIVE_MARKER,
        deletedAt: null,
      },
    });
    if (!document) throw new BadRequestException("Dokumen Archive tidak ditemukan.");
    const workspace = await this.flow.workspace(document.workspaceId, user);
    this.flow.requireStatus(workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);

    const decision = String(body.decision || "").trim().toUpperCase();
    if (!["VALID", "INVALID"].includes(decision)) {
      throw new BadRequestException("Pilih keputusan Valid atau Tidak Valid.");
    }
    const note = String(body.note || "").trim();
    if (decision === "INVALID" && !note) {
      throw new BadRequestException(
        "Catatan wajib diisi apabila dokumen Archive tidak valid.",
      );
    }

    const updated = await this.flow.prisma.evidence.update({
      where: { id },
      data: {
        reviewStatus: decision as any,
        validationNote:
          note ||
          (decision === "VALID"
            ? "Dokumen bertanda tangan lengkap dan dapat diarsipkan."
            : null),
        validatedAt: new Date(),
      },
    });
    await this.flow.log(
      user.id,
      user.username,
      decision === "VALID"
        ? "SIGNED_AUDIT_ARCHIVE_VALIDATED"
        : "SIGNED_AUDIT_ARCHIVE_INVALIDATED",
      "Evidence",
      id,
      document.workspaceId,
      { decision, note: note || null },
    );
    return updated;
  }

  @Delete("archive-documents/:id")
  @Roles("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN")
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    const document = await this.flow.prisma.evidence.findFirst({
      where: {
        id,
        auditQuestionId: null,
        description: SIGNED_ARCHIVE_MARKER,
        deletedAt: null,
      },
    });
    if (!document) throw new BadRequestException("Dokumen Archive tidak ditemukan.");
    const workspace = await this.flow.workspace(document.workspaceId, user);
    this.flow.requireStatus(workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
    this.requireUploader(workspace, user);
    const isAdmin = this.flow.hasRole(user, ["SUPER_ADMIN", "ADMIN_MUTU"]);
    if (document.uploadedById !== user.id && !isAdmin) {
      throw new ForbiddenException(
        "Dokumen hanya dapat dihapus oleh pengunggah atau Admin Mutu.",
      );
    }
    if (document.reviewStatus === "VALID" && !isAdmin) {
      throw new BadRequestException("Dokumen Archive yang sudah Valid dikunci.");
    }

    const target = resolve(process.cwd(), document.storageKey);
    const root = resolve(process.cwd(), "storage");
    if (target.startsWith(root)) await unlink(target).catch(() => undefined);
    await this.flow.prisma.evidence.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }
}
