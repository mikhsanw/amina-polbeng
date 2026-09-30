import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "./auth";
import { InstrumentExcelController } from "./instrument-excel.controller";
import { PrismaService } from "./prisma.service";

// ExcelJS already depends on JSZip. Using require keeps this compatibility layer
// independent from the JSZip type declarations used by a particular npm release.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip: any = require("jszip");

const SPREADSHEET_NAMESPACE =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpreadsheetNamespace(xml: string) {
  const root = xml.match(
    new RegExp(
      `<([A-Za-z_][\\w.-]*):[A-Za-z_][\\w.-]*\\b[^>]*xmlns:\\1=["']${escapeRegex(
        SPREADSHEET_NAMESPACE,
      )}["']`,
    ),
  );
  if (!root) return xml;

  const prefix = root[1];
  const escapedPrefix = escapeRegex(prefix);
  return xml
    .replace(
      new RegExp(`(<\\/?)(?:${escapedPrefix}):`, "g"),
      "$1",
    )
    .replace(
      new RegExp(
        `\\sxmlns:${escapedPrefix}=["']${escapeRegex(
          SPREADSHEET_NAMESPACE,
        )}["']`,
      ),
      ` xmlns="${SPREADSHEET_NAMESPACE}"`,
    );
}

function normalizeRelationshipTargets(xml: string, path: string) {
  return xml.replace(
    /Target=(["'])\/xl\/([^"']+)\1/g,
    (_match, quote: string, target: string) => {
      if (path === "_rels/.rels") {
        return `Target=${quote}xl/${target}${quote}`;
      }
      if (path === "xl/_rels/workbook.xml.rels") {
        return `Target=${quote}${target}${quote}`;
      }
      if (path.startsWith("xl/worksheets/_rels/")) {
        return `Target=${quote}../${target}${quote}`;
      }
      return `Target=${quote}/xl/${target}${quote}`;
    },
  );
}

async function normalizeOoxmlPackage(buffer: Buffer) {
  let zip: any;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new BadRequestException(
      "File .xlsx tidak mempunyai struktur ZIP Open XML yang valid.",
    );
  }

  let changed = false;
  const paths = Object.keys(zip.files || {});
  for (const path of paths) {
    if (!path.endsWith(".xml") && !path.endsWith(".rels")) continue;
    const entry = zip.file(path);
    if (!entry) continue;

    const original = await entry.async("string");
    let normalized = original.replace(/^\uFEFF/, "");
    if (path.endsWith(".xml")) {
      normalized = normalizeSpreadsheetNamespace(normalized);
    }
    if (path.endsWith(".rels")) {
      normalized = normalizeRelationshipTargets(normalized, path);
    }

    if (normalized !== original) {
      zip.file(path, normalized);
      changed = true;
    }
  }

  if (!changed) return { buffer, changed: false };
  const normalizedBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { buffer: Buffer.from(normalizedBuffer), changed: true };
}

@Controller()
@Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
export class InstrumentExcelCompatibilityController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("master-admin/questions/import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importQuestions(@UploadedFile() file: any) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("File Excel wajib dipilih.");
    }

    const normalized = await normalizeOoxmlPackage(Buffer.from(file.buffer));
    const importer = new InstrumentExcelController(this.prisma);
    const result = await importer.importQuestions({
      ...file,
      buffer: normalized.buffer,
    });

    return {
      ...result,
      compatibilityNormalized: normalized.changed,
    };
  }
}
