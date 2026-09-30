import { AppService } from "./app.service";
import { AmiWorkflowService } from "./ami-workflow.service";
export declare class AuditPlanningController {
    private readonly flow;
    private readonly app;
    constructor(flow: AmiWorkflowService, app: AppService);
    listPrograms(): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            workspaces: number;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        status: string;
        updatedAt: Date;
        code: string;
        auditYear: number;
        startDate: Date;
        endDate: Date;
    })[]>;
    createProgram(body: any): import(".prisma/client").Prisma.Prisma__AuditProgramClient<{
        id: string;
        createdAt: Date;
        name: string;
        status: string;
        updatedAt: Date;
        code: string;
        auditYear: number;
        startDate: Date;
        endDate: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updateProgram(id: string, body: any, user: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        status: string;
        updatedAt: Date;
        code: string;
        auditYear: number;
        startDate: Date;
        endDate: Date;
    }>;
    deleteProgram(id: string, cascadeValue: string | undefined, body: any, user: any): Promise<{
        ok: boolean;
        deletedWorkspaces: number;
    }>;
    listWorkspaces(user: any): import(".prisma/client").Prisma.PrismaPromise<({
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
                id: string;
                username: string;
                fullName: string;
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
    })[]>;
    createWorkspace(body: any, user: any): Promise<{
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
    }>;
    oneWorkspace(id: string, user: any): Promise<{
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
    }>;
    deleteWorkspace(id: string, user: any): Promise<{
        ok: boolean;
    }>;
    generateInstrument(id: string, user: any): Promise<{
        count: number;
        unitCode: string;
    }>;
    questions(id: string, user: any, pageValue?: string, limitValue?: string): Promise<{
        data: ({
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
        total: number;
        page: number;
        limit: number;
    }>;
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
            instrumentReviews: {
                id: string;
                createdAt: Date;
                workspaceId: string;
                auditQuestionId: string;
                verifierUserId: string;
                decision: import(".prisma/client").$Enums.InstrumentDecision;
                note: string | null;
                beforeValue: import("@prisma/client/runtime/library").JsonValue;
                proposedValue: import("@prisma/client/runtime/library").JsonValue;
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
            } | null;
            uploadedBy: {
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
        workpapers: never[] | ({
            question: {
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
            };
            auditor: {
                fullName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            reviewedById: string | null;
            reviewedAt: Date | null;
            auditQuestionId: string;
            standardResult: import(".prisma/client").$Enums.StandardAchievementResult | null;
            processResult: import(".prisma/client").$Enums.ProcessAuditResult | null;
            submittedAt: Date | null;
            auditorUserId: string;
            sampleDescription: string | null;
            interviewee: string | null;
            objectiveEvidence: string | null;
            auditorAnalysis: string | null;
            auditStatus: import(".prisma/client").$Enums.WorkpaperStatus;
            documentStatus: import(".prisma/client").$Enums.WorkpaperDocumentStatus;
            maturityScore: number | null;
            reviewNote: string | null;
            lockedAt: Date | null;
        })[];
        findings: ({
            actions: ({
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
            } & {
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
            })[];
        } & {
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
        })[];
        actions: ({
            finding: {
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
            };
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
        } & {
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
        })[];
        prints: {
            id: string;
            createdAt: Date;
            status: string;
            workspaceId: string;
            version: number;
            fileName: string;
            storageKey: string;
            type: string;
        }[];
        users: {
            unit: {
                name: string;
                code: string;
            } | null;
            id: string;
            username: string;
            fullName: string;
            unitId: string | null;
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
        }[];
        availableInstrumentCount: number;
    }>;
    addTeam(id: string, body: any, user: any): Promise<{
        role: string;
        id: string;
        userId: string;
        workspaceId: string;
    }>;
    removeTeam(id: string, teamId: string, user: any): Promise<{
        ok: boolean;
    }>;
}
