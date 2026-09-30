import { AmiWorkflowService } from "./ami-workflow.service";
export declare class InstrumentApprovalController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    private notifyAdminMutu;
    private notifyAuditee;
    history(id: string, user: any): Promise<{
        previousWorkspace: null;
        questions: never[];
    } | {
        previousWorkspace: {
            id: string;
            name: string;
            auditYear: number;
        };
        questions: {
            masterQuestionId: string;
            question: string;
            excluded: boolean;
            response: string | null;
            evidenceSummary: string | null;
            constraintNote: string | null;
            standardResult: import(".prisma/client").$Enums.StandardAchievementResult | null;
            processResult: import(".prisma/client").$Enums.ProcessAuditResult | null;
            responseStatus: string | null;
        }[];
    }>;
    verifyQuestion(id: string, questionId: string, body: any, user: any): Promise<{
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
    }>;
    submitReview(id: string, body: any, user: any): Promise<{
        ok: boolean;
        total: number;
        submittedCount: number;
        changeCount: number;
        status: string;
    }>;
    validate(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
        total: number;
    }>;
    returnReview(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
        invalid: number;
    }>;
    activate(id: string, body: any, user: any): Promise<{
        status: string;
        ok: boolean;
        count: number;
    }>;
}
