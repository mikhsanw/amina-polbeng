import { Prisma, PrismaClient } from "@prisma/client";

const MAX_ATTEMPTS = 5;

function prefixFor(auditYear: number) {
  return `FND-${auditYear}-`;
}

/**
 * Kode temuan berikutnya untuk tahun audit: nomor tertinggi yang pernah dipakai
 * di seluruh unit + 1. Kode temuan unik secara global, jadi tidak boleh dihitung
 * dari count() per workspace (unit kedua akan bentrok) atau dari jumlah baris
 * (bentrok setelah ada temuan yang dihapus).
 */
export async function nextFindingCode(
  prisma: Pick<PrismaClient, "finding">,
  auditYear: number,
) {
  const prefix = prefixFor(auditYear);
  const last = await prisma.finding.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNumber = last ? Number(last.code.slice(prefix.length)) : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

function isFindingCodeConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return String(target ?? "").includes("code");
}

/**
 * Menjalankan pembuatan temuan dengan kode berurutan. `run` boleh berupa satu
 * transaksi utuh; bila kode bentrok dengan penyimpanan bersamaan, seluruh
 * transaksi dibatalkan oleh database lalu dicoba lagi dengan kode berikutnya.
 */
export async function withFindingCode<T>(
  prisma: Pick<PrismaClient, "finding">,
  auditYear: number,
  run: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const code = await nextFindingCode(prisma, auditYear);
    try {
      return await run(code);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isFindingCodeConflict(error)) throw error;
    }
  }
}
