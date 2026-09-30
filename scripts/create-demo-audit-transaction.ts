import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const YEAR = 2026;
const PROGRAM_CODE = 'AMI-NONAK-2026-001';
const FINDING_CODE = 'FND-2026-00001';
const EVIDENCE_CODE = 'EVD-2026-000001';

async function main() {
  const [adminMutu, auditor, ketua, auditee, kepala, p4mp, verifier] = await Promise.all(
    ['admin_mutu', 'auditor', 'ketua_auditor', 'auditee', 'kepala_unit', 'p4mp', 'verifikator']
      .map(username => p.user.findUniqueOrThrow({ where: { username } })),
  );
  const unit = await p.unit.findUniqueOrThrow({ where: { code: 'BUK' } });

  const program = await p.auditProgram.upsert({
    where: { code: PROGRAM_CODE },
    create: {
      code: PROGRAM_CODE,
      name: 'Audit Mutu Internal Nonakademik Bagian Umum dan Keuangan Tahun 2026',
      auditYear: YEAR,
      startDate: new Date('2026-08-03T08:00:00+07:00'),
      endDate: new Date('2026-08-28T16:00:00+07:00'),
      status: 'PUBLISHED',
    },
    update: { status: 'PUBLISHED' },
  });

  const workspace = await p.auditWorkspace.upsert({
    where: { unitId_auditYear: { unitId: unit.id, auditYear: YEAR } },
    create: {
      name: `${unit.slug}_${YEAR}`,
      unitId: unit.id,
      auditYear: YEAR,
      programId: program.id,
      status: 'CLOSED',
      instrumentStatus: 'PUBLISHED',
      instrumentVersion: 1,
    },
    update: { programId: program.id, status: 'CLOSED', instrumentStatus: 'PUBLISHED' },
  });

  for (const [user, role] of [[ketua, 'KETUA_AUDITOR'], [auditor, 'AUDITOR'], [auditee, 'AUDITEE'], [kepala, 'KEPALA_UNIT'], [p4mp, 'P4MP_VERIFIKATOR'], [verifier, 'VERIFIKATOR']] as const) {
    await p.auditTeam.upsert({
      where: { workspaceId_userId_role: { workspaceId: workspace.id, userId: user.id, role } },
      create: { workspaceId: workspace.id, userId: user.id, role }, update: {},
    });
  }

  const masters = await p.masterQuestion.findMany({
    where: { active: true, OR: [{ unitMaps: { some: { unitId: unit.id } } }, { unitMaps: { none: {} } }] },
    orderBy: [{ moduleCode: 'asc' }, { code: 'asc' }],
  });
  for (let i = 0; i < masters.length; i++) {
    const q = masters[i];
    await p.auditQuestion.upsert({
      where: { workspaceId_masterQuestionId: { workspaceId: workspace.id, masterQuestionId: q.id } },
      create: { workspaceId: workspace.id, masterQuestionId: q.id, questionSnapshot: q.question, moduleCode: q.moduleCode, required: q.required, weight: q.weight, sortOrder: i + 1, reviewStatus: 'PUBLISHED' },
      update: { reviewStatus: 'PUBLISHED' },
    });
  }
  const questions = await p.auditQuestion.findMany({ where: { workspaceId: workspace.id }, orderBy: { sortOrder: 'asc' }, take: 3 });
  if (!questions.length) throw new Error('Instrumen audit tidak memiliki pertanyaan.');

  const assessmentTexts = [
    'Unit telah memiliki SOP pengelolaan administrasi, tetapi evaluasi berkala belum terdokumentasi lengkap.',
    'Pelaksanaan pengendalian telah berjalan dan bukti rekaman tersedia pada register unit.',
    'Monitoring dilaksanakan setiap semester melalui rapat evaluasi pimpinan unit.',
  ];
  for (let i = 0; i < questions.length; i++) {
    await p.selfAssessment.upsert({
      where: { auditQuestionId: questions[i].id },
      create: { auditQuestionId: questions[i].id, response: assessmentTexts[i], score: i === 0 ? 2 : 3, responseStatus: 'APPROVED', submittedAt: new Date('2026-08-07T10:00:00+07:00'), approvedAt: new Date('2026-08-08T09:00:00+07:00') },
      update: { response: assessmentTexts[i], score: i === 0 ? 2 : 3, responseStatus: 'APPROVED', submittedAt: new Date('2026-08-07T10:00:00+07:00'), approvedAt: new Date('2026-08-08T09:00:00+07:00') },
    });
  }

  await p.evidence.upsert({
    where: { code: EVIDENCE_CODE },
    create: { code: EVIDENCE_CODE, workspaceId: workspace.id, auditQuestionId: questions[0].id, evidenceType: 'SOP', title: 'SOP Pengendalian Dokumen Bagian Umum dan Keuangan', description: 'Bukti contoh yang diajukan Auditee pada transaksi audit lengkap.', fileName: 'SOP-Pengendalian-Dokumen.pdf', mimeType: 'application/pdf', fileSizeBytes: 248320, storageKey: `demo/${workspace.id}/SOP-Pengendalian-Dokumen.pdf`, checksum: '0'.repeat(64), confidentiality: 'INTERNAL', reviewStatus: 'VALID', uploadedById: auditee.id, validatedAt: new Date('2026-08-12T10:30:00+07:00'), validationNote: 'Dokumen relevan dan dapat ditelusuri.' },
    update: { workspaceId: workspace.id, auditQuestionId: questions[0].id, reviewStatus: 'VALID' },
  });

  await p.workpaper.upsert({
    where: { auditQuestionId_auditorUserId: { auditQuestionId: questions[0].id, auditorUserId: auditor.id } },
    create: { auditQuestionId: questions[0].id, auditorUserId: auditor.id, sampleDescription: 'Sampel SOP, register distribusi dokumen, dan notulen evaluasi semester I.', interviewee: 'Kepala Bagian Umum dan Keuangan', objectiveEvidence: 'SOP tersedia dan diterapkan, namun tidak ditemukan rekaman evaluasi efektivitas tahun berjalan.', auditorAnalysis: 'Pengendalian sudah diterapkan sebagian, tetapi evaluasi berkala belum konsisten dan belum terdokumentasi.', auditStatus: 'NC_MINOR', maturityScore: 2 },
    update: { auditStatus: 'NC_MINOR', maturityScore: 2 },
  });

  const finding = await p.finding.upsert({
    where: { code: FINDING_CODE },
    create: { code: FINDING_CODE, workspaceId: workspace.id, auditQuestionId: questions[0].id, findingType: 'NC_MINOR', criteriaRegulation: 'SOP Pengendalian Dokumen BUK dan Standar Tata Kelola Nonakademik Polbeng', criteriaIso: 'ISO 9001:2015 Klausul 9.1', condition: 'Evaluasi efektivitas pengendalian dokumen belum dilakukan dan direkam sesuai jadwal semester.', objectiveEvidence: 'Tidak tersedia laporan evaluasi semester I 2026 pada saat pemeriksaan.', gapStatement: 'Persyaratan evaluasi berkala telah ditetapkan, tetapi bukti pelaksanaan dan hasil evaluasinya belum tersedia.', riskImpact: 'Dokumen kedaluwarsa berisiko tetap digunakan dan menimbulkan ketidakkonsistenan proses.', status: 'CLOSED', ownerUserId: kepala.id, dueDate: new Date('2026-09-15T16:00:00+07:00') },
    update: { workspaceId: workspace.id, auditQuestionId: questions[0].id, status: 'CLOSED', ownerUserId: kepala.id },
  });

  let action = await p.correctiveAction.findFirst({ where: { findingId: finding.id } });
  const actionData = { correction: 'Unit segera melakukan evaluasi seluruh dokumen aktif dan menarik dokumen yang tidak berlaku.', analysisMethod: '5 WHY', rootCauseStatement: 'Belum ada penanggung jawab dan pengingat jadwal evaluasi dokumen yang ditetapkan secara formal.', correctiveAction: 'Menetapkan PIC, kalender evaluasi semester, formulir evaluasi, dan monitoring penyelesaian oleh Kepala Unit.', successIndicator: '100% dokumen aktif dievaluasi tepat waktu dan rekaman evaluasi tersedia.', picUserId: auditee.id, targetDate: new Date('2026-09-15T16:00:00+07:00'), progressPercent: 100, progressNote: 'PIC dan kalender evaluasi telah ditetapkan; evaluasi semester I selesai serta disahkan Kepala Unit.', status: 'EFFECTIVE' as const };
  action = action ? await p.correctiveAction.update({ where: { id: action.id }, data: actionData }) : await p.correctiveAction.create({ data: { findingId: finding.id, workspaceId: workspace.id, ...actionData } });

  const oldVerification = await p.verification.findFirst({ where: { actionId: action.id, verifierUserId: verifier.id } });
  const verificationData = { implementationResult: 'Tindakan telah dilaksanakan. SK PIC, kalender, formulir, dan laporan evaluasi dapat ditelusuri.', effectivenessResult: 'Efektif. Sampel dokumen menunjukkan versi berlaku terkontrol dan seluruh rekaman evaluasi lengkap.', status: 'EFFECTIVE' as const, verificationDate: new Date('2026-09-20T09:30:00+07:00'), closedAt: new Date('2026-09-20T10:00:00+07:00') };
  const verification = oldVerification ? await p.verification.update({ where: { id: oldVerification.id }, data: verificationData }) : await p.verification.create({ data: { actionId: action.id, verifierUserId: verifier.id, ...verificationData } });

  await p.activityLog.deleteMany({ where: { workspaceId: workspace.id, action: { startsWith: 'DEMO_' } } });
  const logs = [
    [adminMutu, 'DEMO_AUDIT_PLAN_PUBLISHED', 'AuditProgram', program.id], [auditor, 'DEMO_WORKPAPER_AND_FINDING_CREATED', 'Finding', finding.id],
    [auditee, 'DEMO_SELF_ASSESSMENT_AND_CAPA_SUBMITTED', 'CorrectiveAction', action.id], [p4mp, 'DEMO_INSTRUMENT_APPROVED', 'AuditWorkspace', workspace.id],
    [verifier, 'DEMO_ACTION_VERIFIED_EFFECTIVE', 'Verification', verification.id],
  ] as const;
  for (const [user, event, entityType, entityId] of logs) await p.activityLog.create({ data: { userId: user.id, username: user.username, role: user.username.toUpperCase(), action: event, entityType, entityId, workspaceId: workspace.id, result: 'SUCCESS' } });

  await p.notification.deleteMany({ where: { workspaceId: workspace.id, entityType: 'DEMO_AUDIT' } });
  for (const [recipient, event, title, message] of [
    [auditee, 'SELF_ASSESSMENT_OPENED', 'Penilaian mandiri dibuka', `${PROGRAM_CODE} untuk ${unit.name} siap diisi.`],
    [auditor, 'SELF_ASSESSMENT_SUBMITTED', 'Penilaian Auditee diterima', 'Penilaian mandiri dan bukti telah diajukan untuk pemeriksaan auditor.'],
    [verifier, 'VERIFICATION_REQUESTED', 'CAPA menunggu verifikasi', `${FINDING_CODE} telah ditindaklanjuti 100%.`],
    [adminMutu, 'FINDING_CLOSED', 'Temuan ditutup', `${FINDING_CODE} dinyatakan efektif dan ditutup.`],
  ] as const) await p.notification.create({ data: { workspaceId: workspace.id, recipientUserId: recipient.id, event, title, message, entityType: 'DEMO_AUDIT', entityId: workspace.id } });

  console.log(JSON.stringify({ program: program.code, workspace: workspace.name, unit: unit.name, questions: masters.length, assessment: questions.length, evidence: EVIDENCE_CODE, finding: FINDING_CODE, actionStatus: action.status, verification: verification.status, workspaceStatus: workspace.status }, null, 2));
}

main().finally(() => p.$disconnect());
