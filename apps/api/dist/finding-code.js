"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextFindingCode = nextFindingCode;
exports.withFindingCode = withFindingCode;
const client_1 = require("@prisma/client");
const MAX_ATTEMPTS = 5;
function prefixFor(auditYear) {
    return `FND-${auditYear}-`;
}
async function nextFindingCode(prisma, auditYear) {
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
function isFindingCodeConflict(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError))
        return false;
    if (error.code !== "P2002")
        return false;
    const target = error.meta?.target;
    return String(target ?? "").includes("code");
}
async function withFindingCode(prisma, auditYear, run) {
    for (let attempt = 1;; attempt++) {
        const code = await nextFindingCode(prisma, auditYear);
        try {
            return await run(code);
        }
        catch (error) {
            if (attempt >= MAX_ATTEMPTS || !isFindingCodeConflict(error))
                throw error;
        }
    }
}
//# sourceMappingURL=finding-code.js.map