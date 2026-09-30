import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const roles = [
  "SUPER_ADMIN",
  "ADMIN_MUTU",
  "P4MP",
  "AUDITOR",
  "KETUA_AUDITOR",
  "AUDITEE",
  "VERIFIKATOR",
  "PIMPINAN",
] as const;

const permissionsByRole: Record<(typeof roles)[number], string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN_MUTU: [
    "AUDIT_PROGRAM.MANAGE",
    "WORKSPACE.MANAGE",
    "TEAM.MANAGE",
    "INSTRUMENT.GENERATE",
    "AUDIT.MONITOR",
    "REPORT.GENERATE",
    "AUDIT.CLOSE",
  ],
  P4MP: [
    "STANDARD.MANAGE",
    "QUESTION_MASTER.MANAGE",
    "INSTRUMENT_METHOD.MONITOR",
    "REPORT.VIEW",
  ],
  AUDITOR: [
    "INSTRUMENT.REVIEW",
    "ASSESSMENT.REVIEW",
    "EVIDENCE.REVIEW",
    "WORKPAPER.WRITE",
    "WORKPAPER.SUBMIT",
    "FINDING.DRAFT",
    "CAPA.REVIEW",
  ],
  KETUA_AUDITOR: [
    "INSTRUMENT.REVIEW",
    "INSTRUMENT.PUBLISH_UNCHANGED",
    "INSTRUMENT.SUBMIT_CHANGE",
    "WORKPAPER.REVIEW",
    "FINDING.OPEN",
    "CAPA.DECIDE_EFFECTIVENESS",
    "REPORT.PREPARE",
  ],
  AUDITEE: [
    "SELF_ASSESSMENT.WRITE",
    "SELF_ASSESSMENT.SUBMIT",
    "SELF_ASSESSMENT.APPROVE_UNIT",
    "EVIDENCE.UPLOAD",
    "CAPA.WRITE",
    "CAPA.SUBMIT",
  ],
  VERIFIKATOR: [
    "INSTRUMENT_CHANGE.VIEW",
    "INSTRUMENT_CHANGE.COMPARE",
    "INSTRUMENT_CHANGE.APPROVE",
    "INSTRUMENT_CHANGE.RETURN",
    "INSTRUMENT_CHANGE.REJECT",
    "INSTRUMENT_CHANGE.PUBLISH",
  ],
  PIMPINAN: ["DASHBOARD.EXECUTIVE", "REPORT.VIEW"],
};

async function main() {
  const allPermissionCodes = new Set<string>();
  Object.values(permissionsByRole).flat().forEach((code) => allPermissionCodes.add(code));
  for (const code of allPermissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: code },
      update: { name: code },
    });
  }

  for (const code of roles) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: code.replaceAll("_", " ") },
      update: { name: code.replaceAll("_", " ") },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const allowed = permissionsByRole[code].includes("*")
      ? await prisma.permission.findMany()
      : await prisma.permission.findMany({
          where: { code: { in: permissionsByRole[code] } },
        });
    await prisma.rolePermission.createMany({
      data: allowed.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  const obsolete = await prisma.role.findMany({ where: { code: "KEPALA_UNIT" } });
  if (obsolete.length) {
    await prisma.userRole.deleteMany({
      where: { roleId: { in: obsolete.map((role) => role.id) } },
    });
    await prisma.role.deleteMany({ where: { code: "KEPALA_UNIT" } });
  }

  const p4mpUnit = await prisma.unit.upsert({
    where: { code: "P4MP" },
    create: {
      code: "P4MP",
      slug: "Pusat_Penjaminan_Mutu",
      name: "Pusat Penjaminan Mutu dan Pengembangan Pembelajaran",
    },
    update: {},
  });
  const auditeeUnit = await prisma.unit.upsert({
    where: { code: "BUK" },
    create: {
      code: "BUK",
      slug: "Bagian_Umum_dan_Keuangan_BUK",
      name: "Bagian Umum dan Keuangan",
    },
    update: {
      slug: "Bagian_Umum_dan_Keuangan_BUK",
    },
  });

  const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD ?? "Admin123");
  const allRoles = await prisma.role.findMany();
  for (const code of roles) {
    const role = allRoles.find((item) => item.code === code)!;
    const username = code === "SUPER_ADMIN" ? "admin" : code.toLowerCase();
    await prisma.user.upsert({
      where: { username },
      create: {
        username,
        fullName: code.replaceAll("_", " "),
        passwordHash,
        mustChangePassword: true,
        unitId: code === "AUDITEE" ? auditeeUnit.id : p4mpUnit.id,
        isUnitApprover: code === "AUDITEE",
        roles: { create: { roleId: role.id } },
      },
      update: {
        passwordHash,
        isUnitApprover: code === "AUDITEE",
        roles: { deleteMany: {}, create: { roleId: role.id } },
      },
    });
  }

  console.log("Seed role dan akun selesai.");
  console.log("Jalankan npm run import:system untuk mengimpor 25 unit, tupoksi, ISO, dan 250 pertanyaan dari workbook Sistem.");
}

main().finally(() => prisma.$disconnect());
