import { AmiWorkflowService } from "./ami-workflow.service";
export declare class WorkpaperDraftController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    saveDraft(workspaceId: string, body: any, user: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reviewedById: string | null;
        reviewedAt: Date | null;
        auditQuestionId: string;
        standardResult: import(".prisma/client").$Enums.StandardAchievementResult | null;
        processResult: import(".prisma/client").$Enums.ProcessAuditResult | null;
        submittedAt: Date | null;
        auditorUserId: string;
        sampleDescription: string | null;
        interviewee: string | null;
        objectiveEvidence: string | null;
        auditorAnalysis: string | null;
        auditStatus: import(".prisma/client").$Enums.WorkpaperStatus;
        documentStatus: import(".prisma/client").$Enums.WorkpaperDocumentStatus;
        maturityScore: number | null;
        reviewNote: string | null;
        lockedAt: Date | null;
    }>;
}
