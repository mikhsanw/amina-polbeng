import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
export declare const FIELD_NOT_ASSESSED = "FIELD_NOT_ASSESSED";
export declare class WorkflowAutomationService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly app;
    private timer?;
    private running;
    constructor(prisma: PrismaService, app: AppService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private deadlinePassed;
    private notifyAssignment;
    private notifyRoleUsers;
    private fallbackToDefaultForVerification;
    private fallbackToDefaultApproval;
    private closeSelfAssessmentByDeadline;
    private closeDeskReviewByDeadline;
    private undecidedFieldItems;
    private markNotAssessed;
    private repairUndecidedAfterFieldAudit;
    private closeFieldAuditByDeadline;
    private closeReportingByDeadline;
    private closeFollowUpByDeadline;
    runDueTransitions(): Promise<void>;
}
