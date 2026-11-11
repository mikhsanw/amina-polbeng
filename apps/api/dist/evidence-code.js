"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextEvidenceCode = nextEvidenceCode;
exports.withEvidenceCode = withEvidenceCode;
const client_1 = require("@prisma/client");
const MAX_ATTEMPTS = 5;
function prefixFor(auditYear) {
    return `EVD-${auditYear}-`;
}
async function nextEvidenceCode(prisma, auditYear) {
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
function isEvidenceCodeConflict(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError))
        return false;
    if (error.code !== "P2002")
        return false;
    const target = error.meta?.target;
    return String(target ?? "").includes("code");
}
async function withEvidenceCode(prisma, auditYear, create) {
    for (let attempt = 1;; attempt++) {
        const code = await nextEvidenceCode(prisma, auditYear);
        try {
            return await create(code);
        }
        catch (error) {
            if (attempt >= MAX_ATTEMPTS || !isEvidenceCodeConflict(error))
                throw error;
        }
    }
}
//# sourceMappingURL=evidence-code.js.map