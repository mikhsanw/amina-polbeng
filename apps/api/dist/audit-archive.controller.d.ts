import { AmiWorkflowService } from "./ami-workflow.service";
export declare const SIGNED_ARCHIVE_MARKER = "AUDIT_ARCHIVE_SIGNED_REPORT";
export declare class AuditArchiveController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    private requireUploader;
    list(id: string, user: any): Promise<{
        workspace: {
            unit: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                slug: string;
                active: boolean;
            };
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
            } | null;
            team: ({
                user: {
                    unit: {
                        name: string;
                        code: string;
                    } | null;
                    id: string;
                    username: string;
                    fullName: string;
                    unitId: string | null;
                    isUnitApprover: boolean;
                    roles: ({
                        role: {
                            id: string;
                            name: string;
                            code: string;
                        };
                    } & {
                        userId: string;
                        roleId: string;
                    })[];
                };
            } & {
                role: string;
                id: string;
                userId: string;
                workspaceId: string;
            })[];
            _count: {
                evidences: number;
                questions: number;
                findings: number;
                actions: number;
            };
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
        documents: ({
            uploadedBy: {
                id: string;
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
        })[];
        openFindings: number;
        reportCount: number;
    }>;
    upload(id: string, file: any, body: any, user: any): Promise<{
        uploadedBy: {
            id: string;
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
    }>;
    review(id: string, body: any, user: any): Promise<{
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
    remove(id: string, user: any): Promise<{
        ok: boolean;
    }>;
}
