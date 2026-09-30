import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
export declare class DeadlinePlanningController {
    private readonly prisma;
    private readonly app;
    constructor(prisma: PrismaService, app: AppService);
    private detail;
    private ready;
    private validateDeadline;
    save(programId: string, planId: string, body: any, user: any): Promise<{
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
