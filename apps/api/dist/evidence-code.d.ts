import { PrismaClient } from "@prisma/client";
export declare function nextEvidenceCode(prisma: Pick<PrismaClient, "evidence">, auditYear: number): Promise<string>;
export declare function withEvidenceCode<T>(prisma: Pick<PrismaClient, "evidence">, auditYear: number, create: (code: string) => Promise<T>): Promise<T>;
