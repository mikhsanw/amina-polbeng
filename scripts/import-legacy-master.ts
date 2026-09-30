import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function rows(workbook: ExcelJS.Workbook, sheetName: string) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return [];
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const result: Record<string, unknown>[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const item: Record<string, unknown> = {};
    headers.forEach((header, column) => {
      const value = row.getCell(column + 1).value;
      item[header] = value && typeof value === 'object' && 'text' in value ? value.text : value;
    });
    if (Object.values(item).some((value) => value !== null && value !== undefined && value !== '')) result.push(item);
  });
  return result;
}

const text = (value: unknown) => String(value ?? '').trim();
const enabled = (value: unknown) => ['TRUE', '1', 'YES', 'ACTIVE'].includes(text(value).toUpperCase());
const slug = (value: unknown) => text(value).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unit';

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('legacy-sami-system.xlsx');

  const units = rows(workbook, '12_UNITS');
  for (const row of units) {
    const code = text(row.unit_code);
    if (!code) continue;
    await prisma.unit.upsert({
      where: { code },
      create: { code, slug: `${slug(row.unit_name)}_${slug(code)}`, name: text(row.unit_name), active: enabled(row.active) },
      update: { slug: `${slug(row.unit_name)}_${slug(code)}`, name: text(row.unit_name), active: enabled(row.active) },
    });
  }

  const standards = rows(workbook, '14_STANDARDS');
  for (const row of standards) {
    const code = text(row.standard_code || row.code);
    if (!code) continue;
    await prisma.standard.upsert({
      where: { code },
      create: { code, title: text(row.standard_name || row.title), source: text(row.source || row.regulation_source || 'Google Sheet Sistem'), description: text(row.description) || null, active: enabled(row.active) },
      update: { title: text(row.standard_name || row.title), description: text(row.description) || null, active: enabled(row.active) },
    });
  }

  const clauses = rows(workbook, '15_ISO_CLAUSES');
  for (const row of clauses) {
    const code = text(row.clause_code || row.iso_clause || row.code);
    if (!code) continue;
    await prisma.isoClause.upsert({
      where: { code },
      create: { code, title: text(row.clause_title || row.title || row.description), description: text(row.description) || null, active: enabled(row.active) },
      update: { title: text(row.clause_title || row.title || row.description), description: text(row.description) || null, active: enabled(row.active) },
    });
  }

  const questions = rows(workbook, '17_QUESTION_BANK');
  let questionCount = 0;
  for (const row of questions) {
    const code = text(row.question_code);
    const question = text(row.question_text);
    if (!code || !question) continue;
    const clauseCode = text(row.iso_clause).split('|')[0];
    const iso = clauseCode ? await prisma.isoClause.findUnique({ where: { code: clauseCode } }) : null;
    await prisma.masterQuestion.upsert({
      where: { code },
      create: {
        code,
        moduleCode: text(row.module_code) || 'GENERAL',
        question,
        expectedEvidence: text(row.evidence_hint) || null,
        riskLevel: text(row.risk_level) || 'MEDIUM',
        weight: Number(row.weight || 1),
        required: enabled(row.mandatory),
        active: enabled(row.active),
        isoClauseId: iso?.id,
      },
      update: {
        moduleCode: text(row.module_code) || 'GENERAL',
        question,
        expectedEvidence: text(row.evidence_hint) || null,
        riskLevel: text(row.risk_level) || 'MEDIUM',
        weight: Number(row.weight || 1),
        required: enabled(row.mandatory),
        active: enabled(row.active),
        isoClauseId: iso?.id,
      },
    });
    questionCount++;
  }

  // Bentuk pemetaan eksplisit pertanyaan-unit dari aturan 18_Q_UNIT_MAP.
  // Pertanyaan yang tidak cocok dengan aturan tidak boleh otomatis muncul pada semua audit.
  const mappingRules = rows(workbook, '18_Q_UNIT_MAP').filter((row) => enabled(row.active));
  const dbUnits = await prisma.unit.findMany();
  const dbQuestions = await prisma.masterQuestion.findMany();
  await prisma.questionUnitMap.deleteMany();
  let mappingCount = 0;
  for (const question of dbQuestions) {
    for (const unit of dbUnits) {
      const unitCode = unit.code === 'BUK' ? 'BAG_UK' : unit.code;
      const matches = mappingRules.filter((rule) => {
        const subjectMatches = text(rule.mapping_type) === 'QUESTION'
          ? text(rule.question_or_module_code) === question.code
          : text(rule.question_or_module_code) === question.moduleCode;
        if (!subjectMatches) return false;
        const selector = text(rule.unit_selector_type);
        const value = text(rule.unit_selector_value);
        if (selector === 'ALL') return true;
        if (selector === 'UNIT') return value === unitCode;
        if (selector === 'UNIT_TYPE' && value === 'LEADERSHIP') return /^(DIREKTORAT|WADIR)/.test(unitCode);
        if (selector === 'UNIT_TYPE' && value === 'DEPARTMENT') return unitCode.startsWith('JUR_');
        return false;
      }).sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
      if (!matches.length || text(matches.at(-1)?.include_exclude) !== 'INCLUDE') continue;
      await prisma.questionUnitMap.create({ data: { questionId: question.id, unitId: unit.id } });
      mappingCount++;
    }
  }

  console.log(JSON.stringify({ units: units.length, standards: standards.length, clauses: clauses.length, questions: questionCount, questionUnitMappings: mappingCount }));
}

main().finally(() => prisma.$disconnect());
