import { AmiWorkflowService } from "./ami-workflow.service";
export declare const CAPA_EVIDENCE_MARKER = "CAPA_EVIDENCE:";
export declare class CapaVerificationController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    flowDetail(id: string, user: any): Promise<{
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
        findings: {
            actions: {
                evidences: any[];
                verifications: {
                    id: string;
                    status: import(".prisma/client").$Enums.VerificationStatus;
                    auditorUserId: string | null;
                    verifierUserId: string;
                    actionId: string;
                    leadAuditorUserId: string | null;
                    verificationDate: Date;
                    implementationResult: string;
                    effectivenessResult: string;
                    nextReviewDate: Date | null;
                    decidedAt: Date | null;
                    closedAt: Date | null;
                }[];
                correctiveAction: string;
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.ActionStatus;
                updatedAt: Date;
                workspaceId: string;
                findingId: string;
                correction: string;
                analysisMethod: string;
                rootCauseStatement: string;
                successIndicator: string;
                picUserId: string | null;
                targetDate: Date;
                progressPercent: number;
                progressNote: string | null;
            }[];
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.FindingStatus;
            updatedAt: Date;
            code: string;
            workspaceId: string;
            auditQuestionId: string | null;
            objectiveEvidence: string;
            findingType: import(".prisma/client").$Enums.FindingType;
            criteriaRegulation: string;
            criteriaIso: string;
            condition: string;
            gapStatement: string;
            riskImpact: string;
            ownerUserId: string | null;
            dueDate: Date | null;
        }[];
    }>;
    submitCapa(id: string, body: any, user: any): Promise<{
        action: {
            correctiveAction: string;
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.ActionStatus;
            updatedAt: Date;
            workspaceId: string;
            findingId: string;
            correction: string;
            analysisMethod: string;
            rootCauseStatement: string;
            successIndicator: string;
            picUserId: string | null;
            targetDate: Date;
            progressPercent: number;
            progressNote: string | null;
        };
        evidence: {
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
        };
    }>;
    auditorVerification(id: string, body: any, user: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.VerificationStatus;
        auditorUserId: string | null;
        verifierUserId: string;
        actionId: string;
        leadAuditorUserId: string | null;
        verificationDate: Date;
        implementationResult: string;
        effectivenessResult: string;
        nextReviewDate: Date | null;
        decidedAt: Date | null;
        closedAt: Date | null;
    }>;
    leadVerification(id: string, body: any, user: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.VerificationStatus;
        auditorUserId: string | null;
        verifierUserId: string;
        actionId: string;
        leadAuditorUserId: string | null;
        verificationDate: Date;
        implementationResult: string;
        effectivenessResult: string;
        nextReviewDate: Date | null;
        decidedAt: Date | null;
        closedAt: Date | null;
    }>;
}
