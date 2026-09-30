import { AmiWorkflowService } from "./ami-workflow.service";
export declare class SignedReportLibraryController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    list(user: any): Promise<({
        workspace: {
            unit: {
                id: string;
                name: string;
                code: string;
            };
            program: {
                id: string;
                name: string;
                code: string;
            } | null;
        } & {
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
        };
        uploadedBy: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
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
    })[]>;
}
export declare class SignedReportCompatibilityController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    list(user: any): Promise<({
        workspace: {
            unit: {
                id: string;
                name: string;
                code: string;
            };
            program: {
                id: string;
                name: string;
                code: string;
            } | null;
        } & {
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
        };
        uploadedBy: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
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
    })[]>;
}
