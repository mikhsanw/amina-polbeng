"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("./prisma.service");
const auth_1 = require("./auth");
const controllers_1 = require("./controllers");
const app_service_1 = require("./app.service");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_planning_controller_1 = require("./audit-planning.controller");
const annual_audit_planning_controller_1 = require("./annual-audit-planning.controller");
const deadline_planning_controller_1 = require("./deadline-planning.controller");
const deadline_planning_matrix_controller_1 = require("./deadline-planning-matrix.controller");
const instrument_workflow_controller_1 = require("./instrument-workflow.controller");
const instrument_approval_controller_1 = require("./instrument-approval.controller");
const instrument_return_controller_1 = require("./instrument-return.controller");
const instrument_unit_mapping_controller_1 = require("./instrument-unit-mapping.controller");
const instrument_excel_compat_controller_1 = require("./instrument-excel-compat.controller");
const instrument_excel_controller_1 = require("./instrument-excel.controller");
const audit_execution_controller_1 = require("./audit-execution.controller");
const workpaper_draft_controller_1 = require("./workpaper-draft.controller");
const field_audit_decision_controller_1 = require("./field-audit-decision.controller");
const field_correction_submit_controller_1 = require("./field-correction-submit.controller");
const assessment_flow_read_controller_1 = require("./assessment-flow-read.controller");
const assessment_workflow_controller_1 = require("./assessment-workflow.controller");
const auditee_assessment_controller_1 = require("./auditee-assessment.controller");
const evidence_file_controller_1 = require("./evidence-file.controller");
const evidence_link_controller_1 = require("./evidence-link.controller");
const desk_review_correction_controller_1 = require("./desk-review-correction.controller");
const workflow_integrity_controller_1 = require("./workflow-integrity.controller");
const capa_verification_controller_1 = require("./capa-verification.controller");
const report_registration_controller_1 = require("./report-registration.controller");
const report_document_controller_1 = require("./report-document.controller");
const report_signatory_controller_1 = require("./report-signatory.controller");
const audit_archive_controller_1 = require("./audit-archive.controller");
const signed_report_library_controller_1 = require("./signed-report-library.controller");
const institutional_recap_controller_1 = require("./institutional-recap.controller");
const workflow_deadline_controller_1 = require("./workflow-deadline.controller");
const deadline_transition_controller_1 = require("./deadline-transition.controller");
const deadline_close_controller_1 = require("./deadline-close.controller");
const audit_schedule_service_1 = require("./audit-schedule.service");
const workflow_automation_service_1 = require("./workflow-automation.service");
const user_activity_controller_1 = require("./user-activity.controller");
const user_administration_controller_1 = require("./user-administration.controller");
const notification_center_controller_1 = require("./notification-center.controller");
const audit_followup_controller_1 = require("./audit-followup.controller");
const legacy_bootstrap_controller_1 = require("./legacy-bootstrap.controller");
const master_mutations_controller_1 = require("./master-mutations.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true })],
        controllers: [
            controllers_1.HealthController,
            controllers_1.AuthController,
            controllers_1.UsersController,
            user_administration_controller_1.UserAdministrationController,
            notification_center_controller_1.NotificationCenterController,
            instrument_excel_compat_controller_1.InstrumentExcelCompatibilityController,
            instrument_excel_controller_1.InstrumentExcelController,
            controllers_1.MasterController,
            master_mutations_controller_1.MasterMutationsController,
            controllers_1.DashboardController,
            user_activity_controller_1.UserActivityController,
            legacy_bootstrap_controller_1.LegacyBootstrapController,
            institutional_recap_controller_1.InstitutionalRecapController,
            signed_report_library_controller_1.SignedReportCompatibilityController,
            audit_planning_controller_1.AuditPlanningController,
            deadline_planning_matrix_controller_1.DeadlinePlanningMatrixController,
            deadline_planning_controller_1.DeadlinePlanningController,
            annual_audit_planning_controller_1.AnnualAuditPlanningController,
            instrument_workflow_controller_1.InstrumentWorkflowController,
            instrument_return_controller_1.InstrumentReturnController,
            desk_review_correction_controller_1.DeskReviewCorrectionController,
            workflow_integrity_controller_1.WorkflowIntegrityController,
            assessment_flow_read_controller_1.AssessmentFlowReadController,
            deadline_transition_controller_1.DeadlineTransitionController,
            instrument_approval_controller_1.InstrumentApprovalController,
            instrument_unit_mapping_controller_1.InstrumentUnitMappingController,
            workpaper_draft_controller_1.WorkpaperDraftController,
            audit_execution_controller_1.AuditExecutionController,
            evidence_file_controller_1.EvidenceFileController,
            evidence_link_controller_1.EvidenceLinkController,
            capa_verification_controller_1.CapaVerificationController,
            report_registration_controller_1.ReportRegistrationController,
            report_document_controller_1.ReportDocumentController,
            report_signatory_controller_1.ReportSignatoryController,
            audit_archive_controller_1.AuditArchiveController,
            signed_report_library_controller_1.SignedReportLibraryController,
            auditee_assessment_controller_1.AuditeeAssessmentController,
            field_correction_submit_controller_1.FieldCorrectionSubmitController,
            workflow_deadline_controller_1.WorkflowDeadlineController,
            field_audit_decision_controller_1.FieldAuditDecisionController,
            assessment_workflow_controller_1.AssessmentWorkflowController,
            deadline_close_controller_1.DeadlineCloseController,
            audit_followup_controller_1.AuditFollowupController,
            audit_followup_controller_1.AuditSystemQueryController,
        ],
        providers: [
            prisma_service_1.PrismaService,
            app_service_1.AppService,
            ami_workflow_service_1.AmiWorkflowService,
            audit_schedule_service_1.AuditScheduleService,
            workflow_automation_service_1.WorkflowAutomationService,
            { provide: core_1.APP_GUARD, useClass: auth_1.AuthGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map