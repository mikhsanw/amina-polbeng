import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare class DeskReviewCorrectionController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    private plan;
    private notifyAdmins;
    reviewEvidence(id: string, body: any, user: any): Promise<{
        id: string;
        deletedAt: Date | null;
        code: string;
        workspaceId: string;
        reviewStatus: import(".prisma/client").$Enums.EvidenceReviewStatus;
        auditQuestionId: string | null;
        title: string;
        description: string | null;
        evidenceType: import(".prisma/client").$Enums.EvidenceType;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        checksum: string;
        confidentiality: string;
        uploadedById: string;
        uploadedAt: Date;
        validatedAt: Date | null;
        validationNote: string | null;
    }>;
    reviewAssessment(id: string, body: any, user: any): Promise<{
        id: string;
        updatedAt: Date;
        approvedById: string | null;
        approvedAt: Date | null;
        auditQuestionId: string;
        response: string | null;
        implementationDescription: string | null;
        evidenceSummary: string | null;
        constraintNote: string | null;
        responseStatus: string;
        score: import("@prisma/client/runtime/library").Decimal | null;
        standardResult: import(".prisma/client").$Enums.StandardAchievementResult | null;
        processResult: import(".prisma/client").$Enums.ProcessAuditResult | null;
        submittedById: string | null;
        submittedAt: Date | null;
        returnNote: string | null;
    }>;
    submitDeskReview(id: string, user: any): Promise<{
        ok: boolean;
        status: string;
        returnedItems: number;
        invalidEvidences: number;
    }>;
    approveDeskReview(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
        returnedItems: number;
    }>;
}
