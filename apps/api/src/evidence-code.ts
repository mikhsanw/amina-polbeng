import { Prisma, PrismaClient } from "@prisma/client";

const MAX_ATTEMPTS = 5;

function prefixFor(auditYear: number) {
  return `EVD-${auditYear}-`;
}

/**
 * Kode bukti berikutnya untuk tahun audit: nomor tertinggi yang pernah dipakai + 1.
 * Tidak memakai count(), karena jumlah baris turun saat bukti dihapus sehingga
 * kode baru bisa bentrok dengan kode yang masih ada.
 */
export async function nextEvidenceCode(
  prisma: Pick<PrismaClient, "evidence">,
  auditYear: number,
) {
  const prefix = prefixFor(auditYear);
  const last = await prisma.evidence.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNumber = last ? Number(last.code.slice(prefix.length)) : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

function isEvidenceCodeConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return String(target ?? "").includes("code");
}

/**
 * Membuat bukti dengan kode berurutan. Bila dua unggahan bersamaan mendapat
 * kode yang sama, unggahan yang kalah dicoba lagi dengan kode berikutnya.
 */
export async function withEvidenceCode<T>(
  prisma: Pick<PrismaClient, "evidence">,
  auditYear: number,
  create: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const code = await nextEvidenceCode(prisma, auditYear);
    try {
      return await create(code);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isEvidenceCodeConflict(error)) throw error;
    }
  }
}
