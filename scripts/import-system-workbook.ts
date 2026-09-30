import { PrismaClient, QuestionDimension } from "@prisma/client";
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("result" in value) {
      return text((value as { result: unknown }).result);
    }
    if ("text" in value) {
      return text((value as { text: unknown }).text);
    }
    if ("richText" in value && Array.isArray((value as { richText: unknown[] }).richText)) {
      return (value as { richText: Array<{ text?: string }> }).richText
        .map((rt) => rt.text || "")
        .join("")
        .trim();
    }
  }
  return String(value).trim();
}

function yes(value: unknown, fallback = true): boolean {
  const normalized = text(value).toUpperCase();
  if (!normalized) return fallback;
  return ["TRUE", "YA", "YES", "1", "AKTIF", "ACTIVE", "COMPLETE"].includes(normalized);
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unit";
}

function splitCodes(value: unknown): string[] {
  return text(value)
    .split(/[|,;]/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item && !item.startsWith("#"));
}

function rowsByHeader(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headers = (sheet.getRow(1).values as unknown[]).map((value) => text(value));
  const rows: Record<string, unknown>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: Record<string, unknown> = {};
    let populated = false;
    headers.forEach((header, index) => {
      if (!header || index === 0) return;
      const value = row.getCell(index).value;
      record[header] = value;
      if (text(value)) populated = true;
    });
    if (populated) rows.push(record);
  }
  return rows;
}

function sheetRows(workbook: ExcelJS.Workbook, name: string) {
  const sheet = workbook.getWorksheet(name);
  return sheet ? rowsByHeader(sheet) : [];
}

function dimensionFor(
  questionText: string,
  standardCode: string,
  isoClause: string,
): QuestionDimension {
  if (standardCode && !isoClause) return QuestionDimension.STANDARD_ACHIEVEMENT;
  if (!standardCode && isoClause) return QuestionDimension.PROCESS_CONFORMITY;
  const achievementPattern =
    /target|capaian|realisasi|indikator|sasaran|persentase|rasio|jumlah|nilai|skor|tingkat kinerja|ketepatan waktu|melampaui|tercapai|diukur/i;
  return achievementPattern.test(questionText)
    ? QuestionDimension.STANDARD_ACHIEVEMENT
    : QuestionDimension.PROCESS_CONFORMITY;
}

async function main() {
  const workbookPath = resolve(
    process.argv[2] ||
      process.env.SAMI_SYSTEM_WORKBOOK ||
      "seed/SAMI_NONAK_POLBENG_SYSTEM.xlsx",
  );
  if (!existsSync(workbookPath)) {
    throw new Error(
      `Workbook tidak ditemukan: ${workbookPath}. Ekspor Google Sheet Sistem ke XLSX lalu simpan pada seed/SAMI_NONAK_POLBENG_SYSTEM.xlsx.`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  for (const name of [
    "12_UNITS",
    "13_UNIT_FUNCTIONS",
    "15_ISO_CLAUSES",
    "17_QUESTION_BANK",
    "18_Q_UNIT_MAP",
  ]) {
    if (!workbook.getWorksheet(name)) {
      throw new Error(`Sheet wajib ${name} tidak ditemukan.`);
    }
  }

  const unitRows = sheetRows(workbook, "12_UNITS");
  const functionRows = sheetRows(workbook, "13_UNIT_FUNCTIONS");
  const baseStandardRows = sheetRows(workbook, "14_STANDARDS");
  const internalStandardRows = sheetRows(workbook, "28_INTERNAL_STANDARDS");
  const isoRows = sheetRows(workbook, "15_ISO_CLAUSES");
  const bankRows = sheetRows(workbook, "17_QUESTION_BANK");
  const matrixRows = sheetRows(workbook, "30_AUDIT_MATRIX");
  const requirementMapRows = sheetRows(workbook, "24_Q_REQUIREMENT_MAP");
  const unitMapRows = sheetRows(workbook, "18_Q_UNIT_MAP");
  const functionStandardRows = sheetRows(workbook, "29_FUNCTION_STANDARD_MAP");

  await prisma.$transaction(
    async (tx) => {
      const existingUnits = await tx.unit.findMany({ select: { code: true, slug: true } });
      const usedSlugs = new Map<string, string>(existingUnits.map((u) => [u.slug, u.code]));

      for (const row of unitRows) {
        const code = text(row.unit_code).toUpperCase();
        if (!code) continue;
        const name = text(row.unit_name) || code;
        let unitSlug = slug(name);
        const ownerCode = usedSlugs.get(unitSlug);
        if (ownerCode && ownerCode !== code) {
          unitSlug = `${unitSlug}_${code.toLowerCase()}`;
        }
        usedSlugs.set(unitSlug, code);
        await tx.unit.upsert({
          where: { code },
          create: { code, name, slug: unitSlug, active: yes(row.active) },
          update: { name, slug: unitSlug, active: yes(row.active) },
        });
      }
      const units = await tx.unit.findMany();
      const unitByCode = new Map(
        units.map((unit) => [unit.code.toUpperCase(), unit]),
      );

      const sourceFunctionToDatabaseId = new Map<string, string>();
      for (const row of functionRows) {
        const sourceId = text(row.function_id).toUpperCase();
        const unit = unitByCode.get(text(row.unit_code).toUpperCase());
        const code = text(row.function_code).toUpperCase();
        if (!unit || !code) continue;
        const saved = await tx.unitFunction.upsert({
          where: { unitId_code: { unitId: unit.id, code } },
          create: {
            unitId: unit.id,
            code,
            description: text(row.function_statement),
            sourceRef:
              [text(row.source_standard), text(row.source_reference)]
                .filter(Boolean)
                .join(" — ") || null,
            riskLevel: text(row.risk_level).toUpperCase() || null,
            active: yes(row.active),
          },
          update: {
            description: text(row.function_statement),
            sourceRef:
              [text(row.source_standard), text(row.source_reference)]
                .filter(Boolean)
                .join(" — ") || null,
            riskLevel: text(row.risk_level).toUpperCase() || null,
            active: yes(row.active),
          },
        });
        if (sourceId) sourceFunctionToDatabaseId.set(sourceId, saved.id);
      }

      for (const row of baseStandardRows) {
        const code = text(row.standard_code).toUpperCase();
        if (!code) continue;
        await tx.standard.upsert({
          where: { code },
          create: {
            code,
            title: text(row.standard_name) || code,
            source: text(row.standard_name) || code,
            standardType: code.includes("ISO")
              ? "ISO"
              : code.includes("39")
                ? "DIKTI"
                : "REGULATION",
            regulationReference: text(row.version) || null,
            description: text(row.notes) || null,
            active: yes(row.active),
          },
          update: {
            title: text(row.standard_name) || code,
            regulationReference: text(row.version) || null,
            description: text(row.notes) || null,
            active: yes(row.active),
          },
        });
      }

      for (const row of internalStandardRows) {
        const code = text(row.internal_standard_code).toUpperCase();
        if (!code) continue;
        const description = [
          text(row.internal_requirement_statement),
          text(row.regulatory_requirement_summary),
          text(row.notes),
        ]
          .filter(Boolean)
          .join("\n\n");
        await tx.standard.upsert({
          where: { code },
          create: {
            code,
            title: text(row.internal_standard_name) || code,
            source: "Rancangan Standar Internal Polbeng",
            standardType: "INTERNAL",
            regulationReference:
              text(row.permendiktisaintek_39_ref) || null,
            description: description || null,
            active: yes(row.active),
          },
          update: {
            title: text(row.internal_standard_name) || code,
            regulationReference:
              text(row.permendiktisaintek_39_ref) || null,
            description: description || null,
            active: yes(row.active),
          },
        });
      }

      for (const row of isoRows) {
        const code = text(row.clause_no);
        if (!code) continue;
        await tx.isoClause.upsert({
          where: { code },
          create: {
            code,
            title: text(row.clause_theme) || code,
            description: [
              text(row.paraphrased_requirement),
              text(row.audit_focus),
              text(row.amendment_note),
            ]
              .filter(Boolean)
              .join(" — "),
            active: yes(row.active),
          },
          update: {
            title: text(row.clause_theme) || code,
            description: [
              text(row.paraphrased_requirement),
              text(row.audit_focus),
              text(row.amendment_note),
            ]
              .filter(Boolean)
              .join(" — "),
            active: yes(row.active),
          },
        });
      }

      const standards = await tx.standard.findMany();
      const standardByCode = new Map(
        standards.map((standard) => [standard.code.toUpperCase(), standard]),
      );
      const clauses = await tx.isoClause.findMany();
      const clauseByCode = new Map(
        clauses.map((clause) => [clause.code, clause]),
      );
      const bankByCode = new Map(
        bankRows.map((row) => [text(row.question_code).toUpperCase(), row]),
      );
      const requirementByCode = new Map(
        requirementMapRows.map((row) => [
          text(row.question_code).toUpperCase(),
          row,
        ]),
      );
      const sourceRows = matrixRows.length ? matrixRows : bankRows;

      for (const source of sourceRows) {
        const code = text(source.question_code).toUpperCase();
        if (!code) continue;
        const bank = bankByCode.get(code) || source;
        const requirement = requirementByCode.get(code) || {};
        const internalStandardCode = text(
          source.internal_standard_code || requirement.internal_standard_code,
        ).toUpperCase();
        const isoCode = text(source.iso_clause || requirement.iso_clause);
        const internalStandard = standardByCode.get(internalStandardCode);
        const isoClause = clauseByCode.get(isoCode);
        const questionText = text(source.question_text || bank.question_text);
        const dimension = dimensionFor(
          questionText,
          internalStandardCode,
          isoCode,
        );
        const criterionSource =
          internalStandardCode && isoCode
            ? "DIKTI_INTERNAL_AND_ISO_9001"
            : dimension === QuestionDimension.STANDARD_ACHIEVEMENT
              ? "DIKTI_INTERNAL_STANDARD"
              : "ISO_9001_BUSINESS_PROCESS";

        await tx.masterQuestion.upsert({
          where: { code },
          create: {
            code,
            moduleCode:
              text(source.module_code || bank.module_code).toUpperCase() ||
              "GENERAL",
            dimension,
            criterionSource,
            question: questionText,
            auditObjective: text(bank.audit_objective) || null,
            expectedEvidence:
              text(source.evidence_hint || bank.evidence_hint) || null,
            testMethod: text(bank.test_method) || null,
            regulatoryReference:
              text(source.permendiktisaintek_39_ref) || null,
            regulatorySummary: text(source.regulatory_summary) || null,
            internalRequirement: text(source.internal_requirement) || null,
            businessProcess:
              text(source.module_code || bank.module_code) || null,
            riskLevel:
              text(source.risk_level || bank.risk_level).toUpperCase() ||
              "MEDIUM",
            weight: Number(text(source.weight || bank.weight) || 1),
            required: yes(source.mandatory ?? bank.mandatory),
            active: yes(bank.active),
            standardId: internalStandard?.id || null,
            isoClauseId: isoClause?.id || null,
          },
          update: {
            moduleCode:
              text(source.module_code || bank.module_code).toUpperCase() ||
              "GENERAL",
            dimension,
            criterionSource,
            question: questionText,
            auditObjective: text(bank.audit_objective) || null,
            expectedEvidence:
              text(source.evidence_hint || bank.evidence_hint) || null,
            testMethod: text(bank.test_method) || null,
            regulatoryReference:
              text(source.permendiktisaintek_39_ref) || null,
            regulatorySummary: text(source.regulatory_summary) || null,
            internalRequirement: text(source.internal_requirement) || null,
            businessProcess:
              text(source.module_code || bank.module_code) || null,
            riskLevel:
              text(source.risk_level || bank.risk_level).toUpperCase() ||
              "MEDIUM",
            weight: Number(text(source.weight || bank.weight) || 1),
            required: yes(source.mandatory ?? bank.mandatory),
            active: yes(bank.active),
            standardId: internalStandard?.id || null,
            isoClauseId: isoClause?.id || null,
            version: { increment: 1 },
          },
        });
      }

      const questions = await tx.masterQuestion.findMany();
      const questionByCode = new Map(
        questions.map((question) => [question.code.toUpperCase(), question]),
      );
      const questionByModule = new Map<string, typeof questions>();
      for (const question of questions) {
        const list = questionByModule.get(question.moduleCode) || [];
        list.push(question);
        questionByModule.set(question.moduleCode, list);
      }

      await tx.questionUnitMap.deleteMany();
      for (const row of unitMapRows) {
        if (
          !yes(row.active) ||
          text(row.include_exclude).toUpperCase() === "EXCLUDE"
        ) {
          continue;
        }
        const mappingType = text(row.mapping_type).toUpperCase();
        const mappedCode = text(row.question_or_module_code).toUpperCase();
        const mappedQuestions =
          mappingType === "QUESTION"
            ? [questionByCode.get(mappedCode)].filter(Boolean)
            : questionByModule.get(mappedCode) || [];
        const selectorType = text(row.unit_selector_type).toUpperCase();
        const selectorValue = text(row.unit_selector_value).toUpperCase();
        const selectedUnits =
          selectorType === "ALL"
            ? units
            : selectorType === "UNIT_CODE"
              ? [unitByCode.get(selectorValue)].filter(Boolean)
              : units.filter(
                  (unit) => unit.code.toUpperCase() === selectorValue,
                );
        for (const question of mappedQuestions) {
          if (!question) continue;
          for (const unit of selectedUnits) {
            if (!unit) continue;
            await tx.questionUnitMap.upsert({
              where: {
                questionId_unitId: {
                  questionId: question.id,
                  unitId: unit.id,
                },
              },
              create: { questionId: question.id, unitId: unit.id },
              update: {},
            });
          }
        }
      }

      const functionsByStandard = new Map<string, string[]>();
      for (const row of functionStandardRows) {
        const databaseFunctionId = sourceFunctionToDatabaseId.get(
          text(row.function_id).toUpperCase(),
        );
        if (!databaseFunctionId || !yes(row.active)) continue;
        for (const standardCode of splitCodes(row.internal_standard_codes)) {
          const list = functionsByStandard.get(standardCode) || [];
          list.push(databaseFunctionId);
          functionsByStandard.set(standardCode, list);
        }
      }
      await tx.questionFunctionMap.deleteMany();
      for (const source of sourceRows) {
        const question = questionByCode.get(
          text(source.question_code).toUpperCase(),
        );
        if (!question) continue;
        const standardCode = text(
          source.internal_standard_code,
        ).toUpperCase();
        for (const functionId of functionsByStandard.get(standardCode) || []) {
          await tx.questionFunctionMap.upsert({
            where: {
              questionId_functionId: {
                questionId: question.id,
                functionId,
              },
            },
            create: { questionId: question.id, functionId },
            update: {},
          });
        }
      }
    },
    { timeout: 180_000 },
  );

  const counts = await Promise.all([
    prisma.unit.count(),
    prisma.unitFunction.count(),
    prisma.standard.count(),
    prisma.isoClause.count(),
    prisma.masterQuestion.count(),
    prisma.questionUnitMap.count(),
    prisma.questionFunctionMap.count(),
  ]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        workbookPath,
        units: counts[0],
        functions: counts[1],
        standards: counts[2],
        isoClauses: counts[3],
        questions: counts[4],
        unitMappings: counts[5],
        functionMappings: counts[6],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
