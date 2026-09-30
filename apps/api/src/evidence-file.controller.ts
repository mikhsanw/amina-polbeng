import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { CurrentUser } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";

@Controller("audit-flow/evidences")
export class EvidenceFileController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Get(":id/file")
  async openFile(
    @Param("id") id: string,
    @Query("download") download: string | undefined,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | void> {
    const evidence = await this.flow.prisma.evidence.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        evidenceType: true,
        fileName: true,
        mimeType: true,
        storageKey: true,
      },
    });
    if (!evidence) throw new NotFoundException("Dokumen bukti tidak ditemukan.");

    await this.flow.workspace(evidence.workspaceId, user);

    if (evidence.evidenceType === "LINK") {
      let target: URL;
      try {
        target = new URL(evidence.storageKey);
      } catch {
        throw new BadRequestException("Link bukti tidak valid.");
      }
      const host = target.hostname.toLowerCase();
      if (
        target.protocol !== "https:" ||
        !["drive.google.com", "docs.google.com"].includes(host)
      ) {
        throw new BadRequestException("Link bukti bukan Google Drive yang valid.");
      }
      response.setHeader("Cache-Control", "private, no-store, max-age=0");
      response.redirect(target.toString());
      return;
    }

    const parts = String(evidence.storageKey || "")
      .split(/[\\/]+/)
      .filter(Boolean);
    if (
      !parts.length ||
      parts.some((part) => part === "." || part === ".." || part.includes(":"))
    ) {
      throw new BadRequestException("Lokasi dokumen bukti tidak valid.");
    }

    const storageRoot = resolve(process.cwd(), "storage");
    const filePath = resolve(process.cwd(), ...parts);
    const insideStorage = relative(storageRoot, filePath);
    if (
      insideStorage.startsWith("..") ||
      isAbsolute(insideStorage) ||
      insideStorage === ""
    ) {
      throw new BadRequestException(
        "Lokasi dokumen bukti berada di luar penyimpanan audit.",
      );
    }

    let metadata;
    try {
      metadata = await stat(filePath);
    } catch {
      throw new NotFoundException(
        "File bukti tidak ditemukan pada penyimpanan. Rekaman metadata masih tersedia.",
      );
    }
    if (!metadata.isFile()) {
      throw new NotFoundException("Dokumen bukti tidak berupa file.");
    }

    const originalName = String(evidence.fileName || "dokumen-bukti").replace(
      /[\r\n"]/g,
      "_",
    );
    const asciiName = originalName.replace(/[^\x20-\x7E]/g, "_");
    const disposition = download === "1" ? "attachment" : "inline";

    response.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    );
    response.setHeader("Cache-Control", "private, no-store, max-age=0");
    response.setHeader("X-Content-Type-Options", "nosniff");

    return new StreamableFile(createReadStream(filePath), {
      type: evidence.mimeType || "application/octet-stream",
      length: metadata.size,
    });
  }
}
