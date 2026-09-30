import { PrismaService } from "./prisma.service";
export declare class MasterMutationsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    questions(module?: string, dimension?: string, query?: string): import(".prisma/client").Prisma.PrismaPromise<({
        standard: {
            id: string;
            code: string;
            active: boolean;
            title: string;
            source: string;
            standardType: string;
            regulationReference: string | null;
            description: string | null;
        } | null;
        isoClause: {
            id: string;
            code: string;
            active: boolean;
            title: string;
            description: string | null;
        } | null;
        unitMaps: ({
            unit: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                slug: string;
                active: boolean;
            };
        } & {
            unitId: string;
            questionId: string;
        })[];
        functionMaps: ({
            function: {
                id: string;
                unitId: string;
                code: string;
                active: boolean;
                riskLevel: string | null;
                description: string;
                sourceRef: string | null;
            };
        } & {
            questionId: string;
            functionId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    })[]>;
    updateUnit(id: string, body: any): Promise<{
        functions: {
            id: string;
            unitId: string;
            code: string;
            active: boolean;
            riskLevel: string | null;
            description: string;
            sourceRef: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        slug: string;
        active: boolean;
    }>;
    deactivateUnit(id: string): import(".prisma/client").Prisma.Prisma__UnitClient<{
        functions: {
            id: string;
            unitId: string;
            code: string;
            active: boolean;
            riskLevel: string | null;
            description: string;
            sourceRef: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        slug: string;
        active: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    createUnitFunction(unitId: string, body: any): Promise<{
        id: string;
        unitId: string;
        code: string;
        active: boolean;
        riskLevel: string | null;
        description: string;
        sourceRef: string | null;
    }>;
    updateUnitFunction(id: string, body: any): import(".prisma/client").Prisma.Prisma__UnitFunctionClient<{
        id: string;
        unitId: string;
        code: string;
        active: boolean;
        riskLevel: string | null;
        description: string;
        sourceRef: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deactivateUnitFunction(id: string): import(".prisma/client").Prisma.Prisma__UnitFunctionClient<{
        id: string;
        unitId: string;
        code: string;
        active: boolean;
        riskLevel: string | null;
        description: string;
        sourceRef: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    createStandard(body: any): import(".prisma/client").Prisma.Prisma__StandardClient<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        source: string;
        standardType: string;
        regulationReference: string | null;
        description: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updateStandard(id: string, body: any): import(".prisma/client").Prisma.Prisma__StandardClient<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        source: string;
        standardType: string;
        regulationReference: string | null;
        description: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deactivateStandard(id: string): import(".prisma/client").Prisma.Prisma__StandardClient<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        source: string;
        standardType: string;
        regulationReference: string | null;
        description: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    createIsoClause(body: any): import(".prisma/client").Prisma.Prisma__IsoClauseClient<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        description: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updateIsoClause(id: string, body: any): import(".prisma/client").Prisma.Prisma__IsoClauseClient<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        description: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deactivateIsoClause(id: string): import(".prisma/client").Prisma.Prisma__IsoClauseClient<{
        id: string;
        code: string;
        active: boolean;
        title: string;
        description: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    createQuestion(body: any): import(".prisma/client").Prisma.Prisma__MasterQuestionClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updateQuestion(id: string, body: any): import(".prisma/client").Prisma.Prisma__MasterQuestionClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deactivateQuestion(id: string): import(".prisma/client").Prisma.Prisma__MasterQuestionClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        moduleCode: string;
        dimension: import(".prisma/client").$Enums.QuestionDimension;
        criterionSource: string;
        question: string;
        auditObjective: string | null;
        expectedEvidence: string | null;
        testMethod: string | null;
        regulatoryReference: string | null;
        regulatorySummary: string | null;
        internalRequirement: string | null;
        businessProcess: string | null;
        riskLevel: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        required: boolean;
        version: number;
        standardId: string | null;
        isoClauseId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
}
