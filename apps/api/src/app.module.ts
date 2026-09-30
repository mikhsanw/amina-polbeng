import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaService } from "./prisma.service";
import { AuthGuard } from "./auth";
import {
  AuthController,
  DashboardController,
  HealthController,
  MasterController,
  UsersController,
} from "./controllers";
import { AppService } from "./app.service";
import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditPlanningController } from "./audit-planning.controller";
import { AnnualAuditPlanningController } from "./annual-audit-planning.controller";
import { DeadlinePlanningController } from "./deadline-planning.controller";
import { DeadlinePlanningMatrixController } from "./deadline-planning-matrix.controller";
import { InstrumentWorkflowController } from "./instrument-workflow.controller";
import { InstrumentApprovalController } from "./instrument-approval.controller";
import { InstrumentReturnController } from "./instrument-return.controller";
import { InstrumentUnitMappingController } from "./instrument-unit-mapping.controller";
import { InstrumentExcelCompatibilityController } from "./instrument-excel-compat.controller";
import { InstrumentExcelController } from "./instrument-excel.controller";
import { AuditExecutionController } from "./audit-execution.controller";
import { WorkpaperDraftController } from "./workpaper-draft.controller";
import { FieldAuditDecisionController } from "./field-audit-decision.controller";
import { FieldCorrectionSubmitController } from "./field-correction-submit.controller";
import { AssessmentFlowReadController } from "./assessment-flow-read.controller";
import { AssessmentWorkflowController } from "./assessment-workflow.controller";
import { AuditeeAssessmentController } from "./auditee-assessment.controller";
import { EvidenceFileController } from "./evidence-file.controller";
import { EvidenceLinkController } from "./evidence-link.controller";
import { DeskReviewCorrectionController } from "./desk-review-correction.controller";
import { WorkflowIntegrityController } from "./workflow-integrity.controller";
import { CapaVerificationController } from "./capa-verification.controller";
import { ReportRegistrationController } from "./report-registration.controller";
import { ReportDocumentController } from "./report-document.controller";
import { ReportSignatoryController } from "./report-signatory.controller";
import { AuditArchiveController } from "./audit-archive.controller";
import {
  SignedReportCompatibilityController,
  SignedReportLibraryController,
} from "./signed-report-library.controller";
import { InstitutionalRecapController } from "./institutional-recap.controller";
import { WorkflowDeadlineController } from "./workflow-deadline.controller";
import { DeadlineTransitionController } from "./deadline-transition.controller";
import { DeadlineCloseController } from "./deadline-close.controller";
import { AuditScheduleService } from "./audit-schedule.service";
import { WorkflowAutomationService } from "./workflow-automation.service";
import { UserActivityController } from "./user-activity.controller";
import { UserAdministrationController } from "./user-administration.controller";
import { NotificationCenterController } from "./notification-center.controller";
import {
  AuditFollowupController,
  AuditSystemQueryController,
} from "./audit-followup.controller";
import { LegacyBootstrapController } from "./legacy-bootstrap.controller";
import { MasterMutationsController } from "./master-mutations.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    UserAdministrationController,
    NotificationCenterController,
    InstrumentExcelCompatibilityController,
    InstrumentExcelController,
    MasterController,
    MasterMutationsController,
    DashboardController,
    UserActivityController,
    LegacyBootstrapController,
    InstitutionalRecapController,
    // Harus berada sebelum AuditPlanningController karena controller tersebut
    // mempunyai route generik /audit-flow/:id.
    SignedReportCompatibilityController,
    AuditPlanningController,
    DeadlinePlanningMatrixController,
    DeadlinePlanningController,
    AnnualAuditPlanningController,
    InstrumentWorkflowController,
    InstrumentReturnController,
    DeskReviewCorrectionController,
    WorkflowIntegrityController,
    AssessmentFlowReadController,
    DeadlineTransitionController,
    InstrumentApprovalController,
    InstrumentUnitMappingController,
    WorkpaperDraftController,
    AuditExecutionController,
    EvidenceFileController,
    EvidenceLinkController,
    CapaVerificationController,
    ReportRegistrationController,
    ReportDocumentController,
    ReportSignatoryController,
    AuditArchiveController,
    SignedReportLibraryController,
    AuditeeAssessmentController,
    FieldCorrectionSubmitController,
    WorkflowDeadlineController,
    FieldAuditDecisionController,
    AssessmentWorkflowController,
    DeadlineCloseController,
    AuditFollowupController,
    AuditSystemQueryController,
  ],
  providers: [
    PrismaService,
    AppService,
    AmiWorkflowService,
    AuditScheduleService,
    WorkflowAutomationService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
