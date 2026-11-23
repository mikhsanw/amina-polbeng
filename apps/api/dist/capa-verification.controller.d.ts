import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare const CAPA_EVIDENCE_MARKER = "CAPA_EVIDENCE:";
export declare class CapaVerificationController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    private editableCapa;
    private capaLinks;
    flowDetail(id: string, user: any): Promise<{
        workspace: {
            unit: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                slug: string;
                active: boolean;
            };
            program: {
                id: string;
                name: string;
                auditYear: number;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                startDate: Date;
                endDate: Date;
            } | null;
            team: ({
                user: {
                    id: string;
                    unitId: string | null;
                    unit: {
                        name: string;
                        code: string;
                    } | null;
                    username: string;
                    fullName: string;
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
                id: string;
                role: string;
                workspaceId: string;
                userId: string;
            })[];
            _count: {
                questions: number;
                evidences: number;
                findings: number;
                actions: number;
            };
        } & {
            id: string;
            name: string;
            unitId: string;
            auditYear: number;
            programId: string | null;
            status: import(".prisma/client").$Enums.WorkspaceStatus;
            instrumentStatus: import(".prisma/client").$Enums.ReviewStatus;
            instrumentVersion: number;
            instrumentChangeCount: number;
            createdAt: Date;
            updatedAt: Date;
        };
        capaWindow: {
            open: boolean;
            deadline: Date | null;
        };
        findings: {
            actions: {
                evidences: any[];
                verifications: {
                    id: string;
                    status: import(".prisma/client").$Enums.VerificationStatus;
                    verificationDate: Date;
                    actionId: string;
                    verifierUserId: string;
                    auditorUserId: string | null;
                    leadAuditorUserId: string | null;
                    implementationResult: string;
                    effectivenessResult: string;
                    nextReviewDate: Date | null;
                    decidedAt: Date | null;
                    closedAt: Date | null;
                }[];
                id: string;
                status: import(".prisma/client").$Enums.ActionStatus;
                createdAt: Date;
                updatedAt: Date;
                workspaceId: string;
                correctiveAction: string;
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
            question: {
                id: string;
                questionSnapshot: string;
                publishedQuestion: string | null;
            } | null;
            id: string;
            status: import(".prisma/client").$Enums.FindingStatus;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            workspaceId: string;
            auditQuestionId: string | null;
            findingType: import(".prisma/client").$Enums.FindingType;
            criteriaRegulation: string;
            criteriaIso: string;
            condition: string;
            objectiveEvidence: string;
            gapStatement: string;
            riskImpact: string;
            ownerUserId: string | null;
            dueDate: Date | null;
        }[];
    }>;
    submitCapa(id: string, body: any, user: any): Promise<{
        action: {
            id: string;
            status: import(".prisma/client").$Enums.ActionStatus;
            createdAt: Date;
            updatedAt: Date;
            workspaceId: string;
            correctiveAction: string;
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
            auditQuestionId: string | null;
            reviewStatus: import(".prisma/client").$Enums.EvidenceReviewStatus;
            evidenceType: import(".prisma/client").$Enums.EvidenceType;
            title: string;
            description: string | null;
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
    updateCapa(id: string, body: any, user: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ActionStatus;
        createdAt: Date;
        updatedAt: Date;
        workspaceId: string;
        correctiveAction: string;
        findingId: string;
        correction: string;
        analysisMethod: string;
        rootCauseStatement: string;
        successIndicator: string;
        picUserId: string | null;
        targetDate: Date;
        progressPercent: number;
        progressNote: string | null;
    }>;
    deleteCapaEvidence(id: string, user: any): Promise<{
        ok: boolean;
    }>;
    withdrawCapa(id: string, user: any): Promise<{
        ok: boolean;
        deleted: boolean;
    }>;
    auditorVerification(id: string, body: any, user: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.VerificationStatus;
        verificationDate: Date;
        actionId: string;
        verifierUserId: string;
        auditorUserId: string | null;
        leadAuditorUserId: string | null;
        implementationResult: string;
        effectivenessResult: string;
        nextReviewDate: Date | null;
        decidedAt: Date | null;
        closedAt: Date | null;
    }>;
    leadVerification(id: string, body: any, user: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.VerificationStatus;
        verificationDate: Date;
        actionId: string;
        verifierUserId: string;
        auditorUserId: string | null;
        leadAuditorUserId: string | null;
        implementationResult: string;
        effectivenessResult: string;
        nextReviewDate: Date | null;
        decidedAt: Date | null;
        closedAt: Date | null;
    }>;
}
