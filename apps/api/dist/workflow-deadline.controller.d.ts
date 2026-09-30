import { AmiWorkflowService } from "./ami-workflow.service";
export declare class WorkflowDeadlineController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    private plan;
    private validateBounds;
    private validateOrder;
    private notifyAdmins;
    deadlines(id: string, user: any): Promise<{
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
    updateDeadlines(id: string, body: any, user: any): Promise<{
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
    submitDeskReview(id: string, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    approveDeskReview(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    returnDeskReview(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    reassignReviewer(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    completeReporting(id: string, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    completeFollowUp(id: string, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
}
