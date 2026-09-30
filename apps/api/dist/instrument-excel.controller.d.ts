import { Response } from "express";
import { PrismaService } from "./prisma.service";
export declare class InstrumentExcelController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    template(response: Response): Promise<void>;
    importQuestions(file: any): Promise<{
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
