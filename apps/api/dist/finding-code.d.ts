import { PrismaClient } from "@prisma/client";
export declare function nextFindingCode(prisma: Pick<PrismaClient, "finding">, auditYear: number): Promise<string>;
export declare function withFindingCode<T>(prisma: Pick<PrismaClient, "finding">, auditYear: number, run: (code: string) => Promise<T>): Promise<T>;
