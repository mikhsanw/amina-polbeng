import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare class AuditeeAssessmentController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    detail(id: string, user: any): Promise<{
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
        questions: ({
            masterQuestion: {
                standard: {
                    id: string;
                    code: string;
                    active: boolean;
                    title: string;
                    source: string;
                    standardType: string;
                    regulationReference: string | null;
                    description: string | null;
                } | null;
                isoClause: {
                    id: string;
                    code: string;
                    active: boolean;
                    title: string;
                    description: string | null;
                } | null;
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                active: boolean;
                moduleCode: string;
                dimension: import(".prisma/client").$Enums.QuestionDimension;
                criterionSource: string;
                question: string;
                auditObjective: string | null;
                expectedEvidence: string | null;
                testMethod: string | null;
                regulatoryReference: string | null;
                regulatorySummary: string | null;
                internalRequirement: string | null;
                businessProcess: string | null;
                riskLevel: string;
                weight: import("@prisma/client/runtime/library").Decimal;
                required: boolean;
                version: number;
                standardId: string | null;
                isoClauseId: string | null;
            };
            evidences: {
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
            }[];
            findings: {
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
            assessment: {
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
            } | null;
        } & {
            id: string;
            workspaceId: string;
            moduleCode: string;
            dimension: import(".prisma/client").$Enums.QuestionDimension;
            weight: import("@prisma/client/runtime/library").Decimal;
            required: boolean;
            masterQuestionId: string;
            questionSnapshot: string;
            defaultQuestion: string;
            auditorQuestion: string | null;
            publishedQuestion: string | null;
            defaultExpectedEvidence: string | null;
            auditorExpectedEvidence: string | null;
            publishedExpectedEvidence: string | null;
            defaultTestMethod: string | null;
            auditorTestMethod: string | null;
            publishedTestMethod: string | null;
            defaultRiskLevel: string;
            auditorRiskLevel: string | null;
            publishedRiskLevel: string | null;
            defaultWeight: import("@prisma/client/runtime/library").Decimal;
            auditorWeight: import("@prisma/client/runtime/library").Decimal | null;
            publishedWeight: import("@prisma/client/runtime/library").Decimal | null;
            sortOrder: number;
            changeFlag: boolean;
            changeFields: import("@prisma/client/runtime/library").JsonValue | null;
            changeReason: string | null;
            auditorNote: string | null;
            verifierNote: string | null;
            excluded: boolean;
            exclusionReason: string | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            approvedById: string | null;
            approvedAt: Date | null;
            reviewStatus: import(".prisma/client").$Enums.ReviewStatus;
        })[];
        evidences: ({
            auditQuestion: {
                id: string;
                sortOrder: number;
            } | null;
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
        schedule: {
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
        } | null;
    }>;
    saveAnswer(id: string, body: any, user: any): Promise<{
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
    upload(id: string, file: any, body: any, user: any): Promise<{
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
