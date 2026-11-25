import { AmiWorkflowService } from "./ami-workflow.service";
export declare class WorkflowDeadlineController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    private plan;
    private validateBounds;
    private validateOrder;
    private notifyAdmins;
    deadlines(id: string, user: any): Promise<{
        status: string;
        selfAssessmentEnd: Date | null;
        selfAssessmentReviewEnd: Date | null;
        fieldAuditEnd: Date | null;
        reportingEnd: Date | null;
        followUpEnd: Date | null;
        id: string;
        workspaceId: string | null;
        createdAt: Date;
        unitId: string;
        updatedAt: Date;
        programId: string;
        included: boolean;
        instrumentReviewStart: Date | null;
        instrumentReviewEnd: Date | null;
        instrumentVerificationStart: Date | null;
        instrumentVerificationEnd: Date | null;
        selfAssessmentStart: Date | null;
        selfAssessmentReviewStart: Date | null;
        fieldAuditStart: Date | null;
        reportingStart: Date | null;
        followUpStart: Date | null;
    }>;
    updateDeadlines(id: string, body: any, user: any): Promise<{
        reopened: {
            from: string;
            to: string;
            phase: string;
            deadline: Date;
        } | null;
        status: string;
        selfAssessmentEnd: Date | null;
        selfAssessmentReviewEnd: Date | null;
        fieldAuditEnd: Date | null;
        reportingEnd: Date | null;
        followUpEnd: Date | null;
        id: string;
        workspaceId: string | null;
        createdAt: Date;
        unitId: string;
        updatedAt: Date;
        programId: string;
        included: boolean;
        instrumentReviewStart: Date | null;
        instrumentReviewEnd: Date | null;
        instrumentVerificationStart: Date | null;
        instrumentVerificationEnd: Date | null;
        selfAssessmentStart: Date | null;
        selfAssessmentReviewStart: Date | null;
        fieldAuditStart: Date | null;
        reportingStart: Date | null;
        followUpStart: Date | null;
    }>;
    private reopenAfterExtension;
    private notifyUnitAuditees;
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
