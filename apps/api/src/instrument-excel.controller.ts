import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import ExcelJS from "exceljs";
import { Roles } from "./auth";
import { PrismaService } from "./prisma.service";

function cellText(cell: ExcelJS.Cell | undefined) {
  const value: any = cell?.value;
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part: any) => part.text || "").join("").trim();
    }
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (value.hyperlink != null) return String(value.text || value.hyperlink).trim();
  }
  return String(value).trim();
}

function yes(value: unknown, fallback = true) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return fallback;
  return ["YA", "YES", "TRUE", "1", "AKTIF", "WAJIB"].includes(text);
}

function splitCodes(value: unknown) {
  return [
    ...new Set(
      String(value ?? "")
        .split(/[|,;]/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function headerMap(sheet: ExcelJS.Worksheet) {
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    headers.set(cellText(cell).toLowerCase(), column);
  });
  return headers;
}

function rowValue(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  name: string,
) {
  return cellText(row.getCell(headers.get(name) || 0));
}

function requireHeaders(
  sheet: ExcelJS.Worksheet,
  headers: Map<string, number>,
  required: string[],
) {
  const missing = required.filter((name) => !headers.has(name));
  if (missing.length) {
    throw new BadRequestException(
      `Sheet ${sheet.name}: kolom wajib tidak ditemukan: ${missing.join(", ")}.`,
    );
  }
}

function databaseErrorMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  return message
    .replace(/\s+/g, " ")
    .replace(/Invalid `[^`]+` invocation:?/gi, "")
    .trim()
    .slice(0, 500);
}

function validateLength(
  value: string | null,
  field: string,
  errors: string[],
  maximum = 191,
) {
  if (value && value.length > maximum) {
    errors.push(`${field} melebihi ${maximum} karakter`);
  }
}

function unitSlug(code: string) {
  const normalized = code
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return `unit-${normalized || "import"}`;
}

@Controller()
@Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
export class InstrumentExcelController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("master/questions/template")
  async template(@Res() response: Response) {
    const [questions, units, standards, clauses] = await Promise.all([
      this.prisma.masterQuestion.findMany({
        where: { active: true },
        include: {
          standard: true,
          isoClause: true,
          unitMaps: { include: { unit: true } },
        },
        orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
      }),
      this.prisma.unit.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.standard.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.isoClause.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SAMI-NONAK POLBENG";

    const guide = workbook.addWorksheet("00_PETUNJUK");
    guide.columns = [{ width: 30 }, { width: 100 }];
    guide.addRows([
      [
        "FUNGSI",
        "Template ini dapat diunduh, diedit, lalu diunggah kembali ke Bank Instrumen.",
      ],
      [
        "QUESTION_CODE",
        "Kode unik butir. Kode yang sudah ada akan diperbarui; kode baru akan ditambahkan.",
      ],
      [
        "SOURCE_TYPE",
        "Isi ISO untuk klausul ISO 9001:2015 atau SPMI untuk standar internal/Dikti.",
      ],
      [
        "SOURCE_CODE",
        "Kode klausul ISO atau kode standar SPMI yang tersedia pada sheet 02_REFERENSI.",
      ],
      [
        "UNIT_CODES",
        "Kode unit target. Pisahkan beberapa unit dengan tanda |, misalnya BUK|P4MP.",
      ],
      ["DIMENSION", "STANDARD_ACHIEVEMENT atau PROCESS_CONFORMITY."],
      [
        "REFERENSI_DAN_UNIT",
        "Sheet 02_REFERENSI dan 03_UNIT ikut dibaca saat impor. Kode baru akan ditambahkan sebelum pertanyaan diproses.",
      ],
      [
        "PENTING",
        "Jangan mengubah nama kolom. Baris yang tidak valid tidak akan diimpor dan alasannya akan ditampilkan.",
      ],
    ]);
    guide.getRow(1).font = { bold: true };

    const sheet = workbook.addWorksheet("01_PERTANYAAN", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    const headers = [
      "question_code",
      "module_code",
      "dimension",
      "source_type",
      "source_code",
      "question_text",
      "audit_objective",
      "expected_evidence",
      "test_method",
      "regulatory_reference",
      "internal_requirement",
      "business_process",
      "risk_level",
      "mandatory",
      "active",
      "unit_codes",
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F4C6E" },
    };

    for (const question of questions) {
      const sourceType = question.isoClause ? "ISO" : "SPMI";
      const sourceCode =
        question.isoClause?.code || question.standard?.code || "";
      sheet.addRow([
        question.code,
        question.moduleCode,
        question.dimension,
        sourceType,
        sourceCode,
        question.question,
        question.auditObjective || "",
        question.expectedEvidence || "",
        question.testMethod || "",
        question.regulatoryReference || "",
        question.internalRequirement || "",
        question.businessProcess || "",
        question.riskLevel,
        question.required ? "YA" : "TIDAK",
        question.active ? "YA" : "TIDAK",
        question.unitMaps.map((item) => item.unit.code).join("|"),
      ]);
    }
    sheet.autoFilter = { from: "A1", to: "P1" };
    const widths = [
      18, 18, 25, 14, 18, 65, 38, 42, 28, 28, 38, 28, 14, 12, 10, 36,
    ];
    sheet.columns.forEach((column, index) => {
      column.width = widths[index];
      column.alignment = { vertical: "top", wrapText: true };
    });

    const references = workbook.addWorksheet("02_REFERENSI", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    references.addRow(["reference_type", "code", "title", "status"]);
    references.getRow(1).font = { bold: true };
    for (const item of clauses) {
      references.addRow(["ISO", item.code, item.title, "AKTIF"]);
    }
    for (const item of standards) {
      references.addRow(["SPMI", item.code, item.title, "AKTIF"]);
    }

    const unitSheet = workbook.addWorksheet("03_UNIT");
    unitSheet.addRow(["unit_code", "unit_name", "status"]);
    unitSheet.getRow(1).font = { bold: true };
    for (const unit of units) {
      unitSheet.addRow([unit.code, unit.name, "AKTIF"]);
    }

    const metadata = workbook.addWorksheet("04_METADATA");
    metadata.state = "veryHidden";
    metadata.addRows([
      ["template_type", "MASTER_QUESTION_ROUNDTRIP"],
      ["template_version", "2026-D3"],
      ["exported_at", new Date().toISOString()],
      ["total_questions", questions.length],
      ["total_references", clauses.length + standards.length],
      ["total_units", units.length],
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="Template_Bank_Instrumen_ISO_SPMI_SAMI_NONAK.xlsx"',
    );
    response.send(Buffer.from(buffer));
  }

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
    const extension = String(file.originalname || "").toLowerCase();
    if (!extension.endsWith(".xlsx")) {
      throw new BadRequestException("Format file harus .xlsx.");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer);
    } catch (reason) {
      throw new BadRequestException(
        `File Excel tidak dapat dibaca: ${databaseErrorMessage(reason) || "format workbook tidak valid"}.`,
      );
    }

    const questionSheet =
      workbook.getWorksheet("01_PERTANYAAN") || workbook.worksheets[0];
    if (!questionSheet) {
      throw new BadRequestException("Sheet 01_PERTANYAAN tidak ditemukan.");
    }

    const errors: any[] = [];
    const referenceRows: Array<{
      row: number;
      type: "ISO" | "SPMI";
      code: string;
      title: string;
      active: boolean;
    }> = [];
    const unitRows: Array<{
      row: number;
      code: string;
      name: string;
      active: boolean;
    }> = [];

    const referenceSheet = workbook.getWorksheet("02_REFERENSI");
    if (referenceSheet) {
      const headers = headerMap(referenceSheet);
      requireHeaders(referenceSheet, headers, [
        "reference_type",
        "code",
        "title",
        "status",
      ]);
      const seen = new Set<string>();
      for (let rowNumber = 2; rowNumber <= referenceSheet.rowCount; rowNumber += 1) {
        const row = referenceSheet.getRow(rowNumber);
        const type = rowValue(row, headers, "reference_type").toUpperCase();
        const code = rowValue(row, headers, "code").toUpperCase();
        const title = rowValue(row, headers, "title");
        if (!type && !code && !title) continue;
        const rowErrors: string[] = [];
        if (!(["ISO", "SPMI"] as string[]).includes(type)) {
          rowErrors.push("reference_type harus ISO atau SPMI");
        }
        if (!code) rowErrors.push("code wajib diisi");
        if (!title) rowErrors.push("title wajib diisi");
        validateLength(code, "code", rowErrors);
        validateLength(title, "title", rowErrors);
        const key = `${type}:${code}`;
        if (seen.has(key)) rowErrors.push("referensi duplikat dalam file");
        if (rowErrors.length) {
          errors.push({
            sheet: referenceSheet.name,
            row: rowNumber,
            code,
            errors: rowErrors,
          });
          continue;
        }
        seen.add(key);
        referenceRows.push({
          row: rowNumber,
          type: type as "ISO" | "SPMI",
          code,
          title,
          active: yes(rowValue(row, headers, "status"), true),
        });
      }
    }

    const unitSheet = workbook.getWorksheet("03_UNIT");
    if (unitSheet) {
      const headers = headerMap(unitSheet);
      requireHeaders(unitSheet, headers, ["unit_code", "unit_name", "status"]);
      const seen = new Set<string>();
      for (let rowNumber = 2; rowNumber <= unitSheet.rowCount; rowNumber += 1) {
        const row = unitSheet.getRow(rowNumber);
        const code = rowValue(row, headers, "unit_code").toUpperCase();
        const name = rowValue(row, headers, "unit_name");
        if (!code && !name) continue;
        const rowErrors: string[] = [];
        if (!code) rowErrors.push("unit_code wajib diisi");
        if (!name) rowErrors.push("unit_name wajib diisi");
        validateLength(code, "unit_code", rowErrors);
        validateLength(name, "unit_name", rowErrors);
        if (seen.has(code)) rowErrors.push("unit_code duplikat dalam file");
        if (rowErrors.length) {
          errors.push({
            sheet: unitSheet.name,
            row: rowNumber,
            code,
            errors: rowErrors,
          });
          continue;
        }
        seen.add(code);
        unitRows.push({
          row: rowNumber,
          code,
          name,
          active: yes(rowValue(row, headers, "status"), true),
        });
      }
    }

    let unitsCreated = 0;
    let unitsUpdated = 0;
    let referencesCreated = 0;
    let referencesUpdated = 0;

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          for (const unit of unitRows) {
            const existing = await transaction.unit.findUnique({
              where: { code: unit.code },
              select: { id: true },
            });
            if (existing) {
              await transaction.unit.update({
                where: { id: existing.id },
                data: { active: unit.active },
              });
              unitsUpdated += 1;
            } else {
              await transaction.unit.create({
                data: {
                  code: unit.code,
                  slug: unitSlug(unit.code),
                  name: unit.name,
                  active: unit.active,
                },
              });
              unitsCreated += 1;
            }
          }

          for (const reference of referenceRows) {
            if (reference.type === "ISO") {
              const existing = await transaction.isoClause.findUnique({
                where: { code: reference.code },
                select: { id: true },
              });
              await transaction.isoClause.upsert({
                where: { code: reference.code },
                create: {
                  code: reference.code,
                  title: reference.title,
                  active: reference.active,
                },
                update: {
                  title: reference.title,
                  active: reference.active,
                },
              });
              if (existing) referencesUpdated += 1;
              else referencesCreated += 1;
            } else {
              const existing = await transaction.standard.findUnique({
                where: { code: reference.code },
                select: { id: true },
              });
              await transaction.standard.upsert({
                where: { code: reference.code },
                create: {
                  code: reference.code,
                  title: reference.title,
                  source: "Import Excel Bank Instrumen",
                  standardType: "INTERNAL",
                  active: reference.active,
                },
                update: {
                  title: reference.title,
                  active: reference.active,
                },
              });
              if (existing) referencesUpdated += 1;
              else referencesCreated += 1;
            }
          }
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (reason) {
      throw new BadRequestException(
        `Referensi atau unit gagal disinkronkan: ${databaseErrorMessage(reason) || "kesalahan database"}.`,
      );
    }

    const headers = headerMap(questionSheet);
    requireHeaders(questionSheet, headers, [
      "question_code",
      "module_code",
      "dimension",
      "source_type",
      "source_code",
      "question_text",
      "unit_codes",
    ]);

    const [units, standards, clauses] = await Promise.all([
      this.prisma.unit.findMany({ where: { active: true } }),
      this.prisma.standard.findMany({ where: { active: true } }),
      this.prisma.isoClause.findMany({ where: { active: true } }),
    ]);
    const unitsByCode = new Map(
      units.map((item) => [item.code.toUpperCase(), item]),
    );
    const standardsByCode = new Map(
      standards.map((item) => [item.code.toUpperCase(), item]),
    );
    const clausesByCode = new Map(
      clauses.map((item) => [item.code.toUpperCase(), item]),
    );

    const rows: any[] = [];
    const seenCodes = new Set<string>();
    for (let rowNumber = 2; rowNumber <= questionSheet.rowCount; rowNumber += 1) {
      const row = questionSheet.getRow(rowNumber);
      const code = rowValue(row, headers, "question_code").toUpperCase();
      const questionText = rowValue(row, headers, "question_text");
      if (!code && !questionText) continue;

      const rowErrors: string[] = [];
      const moduleCode = rowValue(row, headers, "module_code").toUpperCase();
      const dimension = rowValue(row, headers, "dimension").toUpperCase();
      const sourceType = rowValue(row, headers, "source_type").toUpperCase();
      const sourceCode = rowValue(row, headers, "source_code").toUpperCase();
      const unitCodes = splitCodes(rowValue(row, headers, "unit_codes"));
      const riskLevel =
        rowValue(row, headers, "risk_level").toUpperCase() || "MEDIUM";
      const auditObjective = rowValue(row, headers, "audit_objective") || null;
      const expectedEvidence = rowValue(row, headers, "expected_evidence") || null;
      const testMethod = rowValue(row, headers, "test_method") || null;
      const regulatoryReference =
        rowValue(row, headers, "regulatory_reference") || null;
      const internalRequirement =
        rowValue(row, headers, "internal_requirement") || null;
      const businessProcess = rowValue(row, headers, "business_process") || null;

      if (!code) rowErrors.push("question_code wajib diisi");
      if (seenCodes.has(code)) {
        rowErrors.push("question_code duplikat dalam file");
      }
      if (!moduleCode) rowErrors.push("module_code wajib diisi");
      if (!(["STANDARD_ACHIEVEMENT", "PROCESS_CONFORMITY"] as string[]).includes(dimension)) {
        rowErrors.push(
          "dimension harus STANDARD_ACHIEVEMENT atau PROCESS_CONFORMITY",
        );
      }
      if (!(["ISO", "SPMI"] as string[]).includes(sourceType)) {
        rowErrors.push("source_type harus ISO atau SPMI");
      }
      if (sourceType === "ISO" && dimension !== "PROCESS_CONFORMITY") {
        rowErrors.push("pertanyaan ISO harus berdimensi PROCESS_CONFORMITY");
      }
      if (sourceType === "SPMI" && dimension !== "STANDARD_ACHIEVEMENT") {
        rowErrors.push("pertanyaan SPMI harus berdimensi STANDARD_ACHIEVEMENT");
      }
      if (!sourceCode) rowErrors.push("source_code wajib diisi");
      if (!questionText) rowErrors.push("question_text wajib diisi");
      if (!unitCodes.length) rowErrors.push("minimal satu unit_codes wajib diisi");
      if (!(["LOW", "MEDIUM", "HIGH"] as string[]).includes(riskLevel)) {
        rowErrors.push("risk_level harus LOW, MEDIUM, atau HIGH");
      }

      validateLength(code, "question_code", rowErrors);
      validateLength(moduleCode, "module_code", rowErrors);
      validateLength(sourceCode, "source_code", rowErrors);
      validateLength(questionText, "question_text", rowErrors);
      validateLength(auditObjective, "audit_objective", rowErrors);
      validateLength(expectedEvidence, "expected_evidence", rowErrors);
      validateLength(testMethod, "test_method", rowErrors);
      validateLength(
        regulatoryReference,
        "regulatory_reference",
        rowErrors,
      );
      validateLength(internalRequirement, "internal_requirement", rowErrors);
      validateLength(businessProcess, "business_process", rowErrors);

      const unknownUnits = unitCodes.filter(
        (unitCode) => !unitsByCode.has(unitCode),
      );
      if (unknownUnits.length) {
        rowErrors.push(`kode unit tidak ditemukan: ${unknownUnits.join("|")}`);
      }

      const isoClause =
        sourceType === "ISO" ? clausesByCode.get(sourceCode) : undefined;
      const standard =
        sourceType === "SPMI" ? standardsByCode.get(sourceCode) : undefined;
      if (sourceType === "ISO" && !isoClause) {
        rowErrors.push(`klausul ISO ${sourceCode} tidak ditemukan`);
      }
      if (sourceType === "SPMI" && !standard) {
        rowErrors.push(`standar SPMI ${sourceCode} tidak ditemukan`);
      }

      if (rowErrors.length) {
        errors.push({
          sheet: questionSheet.name,
          row: rowNumber,
          code,
          errors: rowErrors,
        });
        continue;
      }

      seenCodes.add(code);
      rows.push({
        row: rowNumber,
        code,
        moduleCode,
        dimension,
        sourceType,
        question: questionText,
        auditObjective,
        expectedEvidence,
        testMethod,
        regulatoryReference,
        internalRequirement,
        businessProcess,
        riskLevel,
        required: yes(rowValue(row, headers, "mandatory"), true),
        active: yes(rowValue(row, headers, "active"), true),
        unitIds: unitCodes.map((unitCode) => unitsByCode.get(unitCode)!.id),
        standardId: standard?.id || null,
        isoClauseId: isoClause?.id || null,
      });
    }

    const existingQuestions = rows.length
      ? await this.prisma.masterQuestion.findMany({
          where: { code: { in: rows.map((item) => item.code) } },
          select: { id: true, code: true },
        })
      : [];
    const existingByCode = new Map(
      existingQuestions.map((item) => [item.code.toUpperCase(), item]),
    );
    const created = rows.filter((item) => !existingByCode.has(item.code)).length;
    const updated = rows.length - created;

    if (rows.length) {
      try {
        await this.prisma.$transaction(
          async (transaction) => {
            for (const item of rows) {
              const existing = existingByCode.get(item.code);
              const data: any = {
                moduleCode: item.moduleCode,
                dimension: item.dimension,
                criterionSource:
                  item.sourceType === "ISO" ? "ISO_9001" : "SPMI",
                question: item.question,
                auditObjective: item.auditObjective,
                expectedEvidence: item.expectedEvidence,
                testMethod: item.testMethod,
                regulatoryReference: item.regulatoryReference,
                internalRequirement: item.internalRequirement,
                businessProcess: item.businessProcess,
                riskLevel: item.riskLevel,
                weight: 1,
                required: item.required,
                active: item.active,
                standardId: item.standardId,
                isoClauseId: item.isoClauseId,
              };

              const question = existing
                ? await transaction.masterQuestion.update({
                    where: { id: existing.id },
                    data: { ...data, version: { increment: 1 } },
                    select: { id: true },
                  })
                : await transaction.masterQuestion.create({
                    data: { code: item.code, ...data },
                    select: { id: true },
                  });

              await transaction.questionUnitMap.deleteMany({
                where: { questionId: question.id },
              });
              await transaction.questionUnitMap.createMany({
                data: item.unitIds.map((unitId: string) => ({
                  questionId: question.id,
                  unitId,
                })),
                skipDuplicates: true,
              });
            }
          },
          { maxWait: 10_000, timeout: 120_000 },
        );
      } catch (reason) {
        throw new BadRequestException(
          `Bank instrumen gagal disimpan dan seluruh perubahan pertanyaan dibatalkan: ${databaseErrorMessage(reason) || "kesalahan database"}.`,
        );
      }
    }

    return {
      ok: errors.length === 0,
      fileName: file.originalname,
      totalRows: rows.length + errors.filter((item) => item.sheet === questionSheet.name).length,
      imported: rows.length,
      created,
      updated,
      rejected: errors.length,
      references: {
        processed: referenceRows.length,
        created: referencesCreated,
        updated: referencesUpdated,
      },
      units: {
        processed: unitRows.length,
        created: unitsCreated,
        updated: unitsUpdated,
      },
      errors,
    };
  }
}
