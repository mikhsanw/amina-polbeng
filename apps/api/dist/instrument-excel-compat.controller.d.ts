import { PrismaService } from "./prisma.service";
export declare class InstrumentExcelCompatibilityController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    importQuestions(file: any): Promise<{
        compatibilityNormalized: boolean;
        ok: boolean;
        fileName: any;
        totalRows: number;
        imported: number;
        created: number;
        updated: number;
        rejected: number;
        references: {
            processed: number;
            created: number;
            updated: number;
        };
        units: {
            processed: number;
            created: number;
            updated: number;
        };
        errors: any[];
    }>;
}
