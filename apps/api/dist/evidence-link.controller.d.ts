import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare class EvidenceLinkController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    createLink(id: string, body: any, user: any): Promise<{
        id: string;
        code: string;
        workspaceId: string;
        auditQuestionId: string | null;
        evidenceType: import(".prisma/client").$Enums.EvidenceType;
        title: string;
        description: string | null;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        storageKey: string;
        checksum: string;
        confidentiality: string;
        reviewStatus: import(".prisma/client").$Enums.EvidenceReviewStatus;
        uploadedById: string;
        uploadedAt: Date;
        validatedAt: Date | null;
        validationNote: string | null;
        deletedAt: Date | null;
    }>;
}
