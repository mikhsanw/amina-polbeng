import { PrismaService } from "./prisma.service";
export declare class InstrumentUnitMappingController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    replaceUnitMapping(unitId: string, body: any): Promise<{
        unitId: string;
        unitCode: string;
        mappedQuestionCount: number;
        synchronizedEmptyPlans: number;
    }>;
}
