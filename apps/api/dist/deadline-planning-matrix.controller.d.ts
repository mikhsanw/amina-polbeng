import { PrismaService } from "./prisma.service";
export declare class DeadlinePlanningMatrixController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ready;
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
            unit: {
                name: string;
                code: string;
            } | null;
            id: string;
            username: string;
            fullName: string;
            unitId: string | null;
        }[];
        plans: {
            ready: any;
            unit: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                slug: string;
                active: boolean;
            } | undefined;
            assignments: any[];
            questionCount: number;
            defaultInstrumentCount: number;
            _count: {
                questions: number;
            };
            workspace: {
                id: string;
                status: import(".prisma/client").$Enums.WorkspaceStatus;
                updatedAt: Date;
                instrumentStatus: import(".prisma/client").$Enums.ReviewStatus;
            } | null | undefined;
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
}
