import { PrismaService } from "./prisma.service";
export declare class LegacyBootstrapController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private workspaceWhere;
    bootstrap(user: any): Promise<{
        user: {
            id: any;
            username: any;
            fullName: any;
            roles: any;
            unitId: any;
            isUnitApprover: any;
        };
        units: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        }[];
        roles: {
            id: string;
            name: string;
            code: string;
        }[];
        modules: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.MasterQuestionGroupByOutputType, "moduleCode"[]> & {
            _count: number;
        })[];
    }>;
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
    listEvidences(user: any): import(".prisma/client").Prisma.PrismaPromise<({
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
    listAssessments(user: any): import(".prisma/client").Prisma.PrismaPromise<({
        question: {
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
        };
    } & {
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
    })[]>;
    listWorkpapers(user: any): import(".prisma/client").Prisma.PrismaPromise<({
        question: {
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
    })[]>;
    listFindings(user: any): import(".prisma/client").Prisma.PrismaPromise<({
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
        actions: {
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
    })[]>;
    listActions(user: any): import(".prisma/client").Prisma.PrismaPromise<({
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
    })[]>;
    workspaceSummary(id: string, user: any): Promise<{
        answered: number;
        unit: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        };
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
            actions: number;
        };
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
    questions(query?: string, module?: string, pageValue?: string, limitValue?: string): Promise<{
        data: ({
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
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
}
