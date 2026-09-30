import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare class EvidenceLinkController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    createLink(id: string, body: any, user: any): Promise<{
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
}
