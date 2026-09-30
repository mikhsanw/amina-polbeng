import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
export declare class AnnualAuditPlanningController {
    private readonly prisma;
    private readonly app;
    constructor(prisma: PrismaService, app: AppService);
    private ensurePlans;
    private scheduleData;
    private validateScheduleBounds;
    private isReady;
    private getPlan;
    matrix(programId: string): Promise<{
        program: {
            id: string;
            createdAt: Date;
            name: string;
            status: string;
            updatedAt: Date;
            code: string;
            auditYear: number;
            startDate: Date;
            endDate: Date;
        };
        candidates: {
            roles: string[];
            id: string;
            username: string;
            fullName: string;
            unitId: string | null;
        }[];
        plans: {
            ready: boolean;
            unit: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                slug: string;
                active: boolean;
            } | undefined;
            workspace: {
                id: string;
                status: import(".prisma/client").$Enums.WorkspaceStatus;
            } | null | undefined;
            assignments: any[];
            _count: {
                questions: number;
            };
            questionCount: number;
            defaultInstrumentCount: number;
            id: string;
            createdAt: Date;
            status: string;
            unitId: string;
            updatedAt: Date;
            workspaceId: string | null;
            programId: string;
            instrumentReviewStart: Date | null;
            instrumentReviewEnd: Date | null;
            instrumentVerificationStart: Date | null;
            instrumentVerificationEnd: Date | null;
            selfAssessmentStart: Date | null;
            selfAssessmentEnd: Date | null;
            selfAssessmentReviewStart: Date | null;
            selfAssessmentReviewEnd: Date | null;
            fieldAuditStart: Date | null;
            fieldAuditEnd: Date | null;
            reportingStart: Date | null;
            reportingEnd: Date | null;
            followUpStart: Date | null;
            followUpEnd: Date | null;
            included: boolean;
        }[];
    }>;
    instruments(programId: string, planId: string): Promise<{
        selectedQuestionIds: string[];
        questions: {
            mappedToUnit: boolean;
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
            unitMaps: {
                unitId: string;
            }[];
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
        }[];
    }>;
    savePlan(programId: string, planId: string, body: any, user: any): Promise<{
        ready: boolean;
        id: string;
        createdAt: Date;
        status: string;
        unitId: string;
        updatedAt: Date;
        workspaceId: string | null;
        programId: string;
        instrumentReviewStart: Date | null;
        instrumentReviewEnd: Date | null;
        instrumentVerificationStart: Date | null;
        instrumentVerificationEnd: Date | null;
        selfAssessmentStart: Date | null;
        selfAssessmentEnd: Date | null;
        selfAssessmentReviewStart: Date | null;
        selfAssessmentReviewEnd: Date | null;
        fieldAuditStart: Date | null;
        fieldAuditEnd: Date | null;
        reportingStart: Date | null;
        reportingEnd: Date | null;
        followUpStart: Date | null;
        followUpEnd: Date | null;
        included: boolean;
    }>;
    createWorkspace(programId: string, planId: string, user: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        status: import(".prisma/client").$Enums.WorkspaceStatus;
        unitId: string;
        updatedAt: Date;
        auditYear: number;
        programId: string | null;
        instrumentStatus: import(".prisma/client").$Enums.ReviewStatus;
        instrumentVersion: number;
        instrumentChangeCount: number;
    }>;
}
