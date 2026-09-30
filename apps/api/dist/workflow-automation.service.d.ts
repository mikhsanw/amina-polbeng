import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
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
    private closeFieldAuditByDeadline;
    private closeReportingByDeadline;
    private closeFollowUpByDeadline;
    runDueTransitions(): Promise<void>;
}
