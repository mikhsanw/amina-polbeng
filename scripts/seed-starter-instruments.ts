import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const starterQuestions = [
  {
    code: "BASE-GOV-01",
    moduleCode: "GOVERNANCE",
    criterionSource: "INTERNAL",
    question:
      "Apakah unit memiliki penetapan tugas, fungsi, kewenangan, dan tanggung jawab yang terdokumentasi serta dipahami oleh personel terkait?",
    auditObjective: "Memastikan tata kelola dan pembagian tanggung jawab unit ditetapkan secara jelas.",
    expectedEvidence:
      "SK organisasi, uraian tugas, peta proses, SOP, atau dokumen penetapan tanggung jawab.",
    testMethod: "Telaah dokumen dan wawancara personel terkait.",
    riskLevel: "MEDIUM",
    weight: 1,
    standardCode: "BASE-STD-01",
  },
  {
    code: "BASE-DOC-01",
    moduleCode: "DOCUMENT_CONTROL",
    criterionSource: "ISO_9001",
    question:
      "Apakah dokumen dan rekaman kegiatan unit dikendalikan, diperbarui, mudah ditelusuri, dan terlindung dari penggunaan versi yang tidak berlaku?",
    auditObjective: "Menilai efektivitas pengendalian informasi terdokumentasi.",
    expectedEvidence:
      "Daftar induk dokumen, SOP pengendalian dokumen, rekaman distribusi, arsip, dan bukti revisi.",
    testMethod: "Uji petik dokumen dan rekaman.",
    riskLevel: "MEDIUM",
    weight: 1,
    standardCode: "BASE-STD-01",
    isoCode: "7.5",
  },
  {
    code: "BASE-RISK-01",
    moduleCode: "RISK_MANAGEMENT",
    criterionSource: "ISO_9001",
    question:
      "Apakah unit telah mengidentifikasi risiko dan peluang proses serta menetapkan tindakan pengendalian yang proporsional?",
    auditObjective: "Menilai penerapan pemikiran berbasis risiko pada proses unit.",
    expectedEvidence:
      "Register risiko, rencana mitigasi, evaluasi risiko, dan bukti pelaksanaan pengendalian.",
    testMethod: "Telaah register risiko dan konfirmasi pelaksanaan mitigasi.",
    riskLevel: "HIGH",
    weight: 1,
    standardCode: "BASE-STD-01",
    isoCode: "6.1",
  },
  {
    code: "BASE-PERF-01",
    moduleCode: "PERFORMANCE",
    criterionSource: "ISO_9001",
    question:
      "Apakah unit menetapkan indikator kinerja, memantau hasilnya, dan menggunakan hasil pemantauan untuk perbaikan proses?",
    auditObjective: "Menilai kecukupan pemantauan dan evaluasi kinerja unit.",
    expectedEvidence:
      "Indikator kinerja, target, laporan realisasi, analisis capaian, dan rencana perbaikan.",
    testMethod: "Telaah data kinerja dan wawancara penanggung jawab.",
    riskLevel: "MEDIUM",
    weight: 1,
    standardCode: "BASE-STD-01",
    isoCode: "9.1",
  },
  {
    code: "BASE-IMPR-01",
    moduleCode: "IMPROVEMENT",
    criterionSource: "ISO_9001",
    question:
      "Apakah ketidaksesuaian, keluhan, atau hasil evaluasi ditindaklanjuti melalui analisis penyebab, tindakan koreksi, dan pemeriksaan efektivitas?",
    auditObjective: "Menilai konsistensi tindak lanjut dan perbaikan berkelanjutan.",
    expectedEvidence:
      "Daftar temuan atau keluhan, analisis akar penyebab, rencana tindakan, bukti pelaksanaan, dan evaluasi efektivitas.",
    testMethod: "Uji petik tindak lanjut dan verifikasi bukti efektivitas.",
    riskLevel: "HIGH",
    weight: 1,
    standardCode: "BASE-STD-01",
    isoCode: "10.2",
  },
] as const;

async function main() {
  const units = await prisma.unit.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
  });
  if (!units.length) {
    throw new Error("Belum ada unit aktif. Tambahkan unit sebelum mengisi instrumen awal.");
  }

  const standard = await prisma.standard.upsert({
    where: { code: "BASE-STD-01" },
    create: {
      code: "BASE-STD-01",
      title: "Persyaratan Dasar Tata Kelola dan Proses Unit",
      source: "Template awal SAMI-NONAK",
      standardType: "INTERNAL",
      description:
        "Instrumen awal generik untuk menguji alur perencanaan audit sebelum bank instrumen institusi lengkap diimpor.",
      active: true,
    },
    update: { active: true },
  });

  const isoClauses = new Map<string, string>([
    ["6.1", "Tindakan untuk menangani risiko dan peluang"],
    ["7.5", "Informasi terdokumentasi"],
    ["9.1", "Pemantauan, pengukuran, analisis, dan evaluasi"],
    ["10.2", "Ketidaksesuaian dan tindakan korektif"],
  ]);
  const isoByCode = new Map<string, string>();
  for (const [code, title] of isoClauses) {
    const clause = await prisma.isoClause.upsert({
      where: { code },
      create: { code, title, active: true },
      update: { title, active: true },
    });
    isoByCode.set(code, clause.id);
  }

  for (const row of starterQuestions) {
    const question = await prisma.masterQuestion.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        moduleCode: row.moduleCode,
        dimension: "PROCESS_CONFORMITY",
        criterionSource: row.criterionSource,
        question: row.question,
        auditObjective: row.auditObjective,
        expectedEvidence: row.expectedEvidence,
        testMethod: row.testMethod,
        riskLevel: row.riskLevel,
        weight: row.weight,
        required: true,
        active: true,
        standardId: standard.id,
        isoClauseId: "isoCode" in row ? isoByCode.get(row.isoCode) : null,
      },
      update: {
        question: row.question,
        auditObjective: row.auditObjective,
        expectedEvidence: row.expectedEvidence,
        testMethod: row.testMethod,
        riskLevel: row.riskLevel,
        active: true,
        standardId: standard.id,
        isoClauseId: "isoCode" in row ? isoByCode.get(row.isoCode) : null,
      },
    });

    await prisma.questionUnitMap.createMany({
      data: units.map((unit) => ({ questionId: question.id, unitId: unit.id })),
      skipDuplicates: true,
    });
  }

  console.log(
    `${starterQuestions.length} instrumen awal dipetakan ke ${units.length} unit aktif.`,
  );
  console.log(
    "Instrumen ini adalah template awal. Ganti atau lengkapi dengan bank instrumen resmi institusi.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
