"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowAutomationService = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
let WorkflowAutomationService = class WorkflowAutomationService {
    prisma;
    app;
    timer;
    running = false;
    constructor(prisma, app) {
        this.prisma = prisma;
        this.app = app;
    }
    onModuleInit() {
        const intervalMinutes = Math.max(1, Number(process.env.WORKFLOW_AUTOMATION_MINUTES ?? 5));
        setTimeout(() => this.runDueTransitions(), 5_000);
        this.timer = setInterval(() => this.runDueTransitions(), intervalMinutes * 60_000);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    deadlinePassed(value, now) {
        if (!value)
            return false;
        const deadline = new Date(value);
        deadline.setUTCHours(23, 59, 59, 999);
        return deadline.getTime() < now.getTime();
    }
    async notifyAssignment(workspaceId, role, event, title, message) {
        const assignments = await this.prisma.auditTeam.findMany({
            where: { workspaceId, role },
            select: { userId: true },
        });
        if (!assignments.length)
            return;
        await this.prisma.notification.createMany({
            data: assignments.map((assignment) => ({
                workspaceId,
                recipientUserId: assignment.userId,
                event,
                title,
                message,
                entityType: "AuditWorkspace",
                entityId: workspaceId,
            })),
        });
    }
    async notifyRoleUsers(workspaceId, roleCode, event, title, message, unitId) {
        const recipients = await this.prisma.user.findMany({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                ...(unitId ? { unitId } : {}),
                roles: { some: { role: { code: roleCode } } },
            },
            select: { id: true },
        });
        if (!recipients.length)
            return;
        await this.prisma.notification.createMany({
            data: recipients.map((recipient) => ({
                workspaceId,
                recipientUserId: recipient.id,
                event,
                title,
                message,
                entityType: "AuditWorkspace",
                entityId: workspaceId,
            })),
        });
    }
    async fallbackToDefaultForVerification(workspace) {
        const questions = await this.prisma.auditQuestion.findMany({
            where: { workspaceId: workspace.id },
        });
        if (!questions.length)
            return;
        const now = new Date();
        await this.prisma.$transaction([
            ...questions.map((question) => this.prisma.auditQuestion.update({
                where: { id: question.id },
                data: {
                    auditorQuestion: null,
                    auditorExpectedEvidence: null,
                    auditorTestMethod: null,
                    auditorRiskLevel: null,
                    questionSnapshot: question.defaultQuestion,
                    excluded: false,
                    exclusionReason: null,
                    changeFlag: false,
                    changeFields: [],
                    changeReason: null,
                    auditorNote: "Batas telaah berakhir tanpa submit; sistem meneruskan instrumen default.",
                    reviewedById: null,
                    reviewedAt: now,
                    verifierNote: null,
                    reviewStatus: "PENDING_VERIFICATION",
                },
            })),
            this.prisma.auditWorkspace.update({
                where: { id: workspace.id },
                data: {
                    instrumentStatus: "PENDING_VERIFICATION",
                    status: "INSTRUMENT_APPROVAL",
                    instrumentChangeCount: 0,
                },
            }),
        ]);
        await this.notifyAssignment(workspace.id, "VERIFIER", "INSTRUMENT_APPROVAL_REQUESTED", "Verifikasi instrumen dibuka otomatis", "Ketua Auditor melewati batas submit. Sistem meneruskan instrumen default untuk diverifikasi.");
        await this.app.log(undefined, "SYSTEM", "AUTO_INSTRUMENT_REVIEW_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { questionCount: questions.length, overdue: true, fallback: "DEFAULT" });
    }
    async fallbackToDefaultApproval(workspace) {
        const questions = await this.prisma.auditQuestion.findMany({
            where: { workspaceId: workspace.id },
        });
        if (!questions.length)
            return;
        const now = new Date();
        await this.prisma.$transaction([
            ...questions.map((question) => this.prisma.auditQuestion.update({
                where: { id: question.id },
                data: {
                    auditorQuestion: null,
                    auditorExpectedEvidence: null,
                    auditorTestMethod: null,
                    auditorRiskLevel: null,
                    questionSnapshot: question.defaultQuestion,
                    excluded: false,
                    exclusionReason: null,
                    changeFlag: false,
                    changeFields: [],
                    changeReason: null,
                    verifierNote: "Batas verifikasi berakhir tanpa keputusan lengkap; sistem menggunakan instrumen default.",
                    reviewStatus: "APPROVED",
                    approvedById: null,
                    approvedAt: now,
                },
            })),
            this.prisma.auditWorkspace.update({
                where: { id: workspace.id },
                data: {
                    instrumentStatus: "APPROVED",
                    status: "INSTRUMENT_APPROVAL",
                    instrumentChangeCount: 0,
                },
            }),
        ]);
        await this.notifyRoleUsers(workspace.id, "ADMIN_MUTU", "INSTRUMENT_APPROVED", "Instrumen menunggu publikasi Admin Mutu", `${workspace.unit.name}: Verifikator melewati tenggat. Instrumen default disiapkan untuk keputusan publikasi.`);
        await this.app.log(undefined, "SYSTEM", "AUTO_INSTRUMENT_VERIFICATION_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { questionCount: questions.length, overdue: true, fallback: "DEFAULT" });
    }
    async closeSelfAssessmentByDeadline(workspace) {
        const incomplete = await this.prisma.selfAssessment.count({
            where: {
                question: { workspaceId: workspace.id, excluded: false },
                OR: [
                    { implementationDescription: null },
                    { implementationDescription: "" },
                ],
            },
        });
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.selfAssessment.updateMany({
                where: { question: { workspaceId: workspace.id, excluded: false } },
                data: {
                    responseStatus: "SUBMITTED",
                    submittedAt: now,
                    returnNote: "Batas self-assessment berakhir; data yang tersedia dikirim otomatis untuk review Auditor.",
                },
            }),
            this.prisma.auditWorkspace.update({
                where: { id: workspace.id },
                data: { status: "DESK_REVIEW" },
            }),
        ]);
        for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
            await this.notifyAssignment(workspace.id, role, "SELF_ASSESSMENT_SUBMITTED", "Self-assessment ditutup oleh tenggat", `${workspace.unit.name}: ${incomplete} butir belum lengkap dan harus diperiksa dalam desk review.`);
        }
        await this.app.log(undefined, "SYSTEM", "AUTO_SELF_ASSESSMENT_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { incomplete, overdue: true });
    }
    async closeDeskReviewByDeadline(workspace) {
        const [unresolved, pendingEvidence] = await Promise.all([
            this.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: workspace.id, excluded: false },
                    responseStatus: { notIn: ["APPROVED", "RETURNED"] },
                },
            }),
            this.prisma.evidence.count({
                where: {
                    workspaceId: workspace.id,
                    deletedAt: null,
                    reviewStatus: "PENDING",
                },
            }),
        ]);
        await this.prisma.auditWorkspace.update({
            where: { id: workspace.id },
            data: { status: "AUDIT" },
        });
        await this.notifyRoleUsers(workspace.id, "ADMIN_MUTU", "SELF_ASSESSMENT_APPROVED", "Tenggat review Auditor berakhir", `${workspace.unit.name}: ${unresolved} butir dan ${pendingEvidence} bukti belum diputuskan. Admin Mutu harus melanjutkan, mengembalikan, atau mengganti Auditor.`);
        await this.app.log(undefined, "SYSTEM", "AUTO_DESK_REVIEW_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { unresolved, pendingEvidence, overdue: true });
    }
    async closeFieldAuditByDeadline(workspace) {
        const unresolved = await this.prisma.selfAssessment.count({
            where: {
                question: { workspaceId: workspace.id, excluded: false },
                responseStatus: { notIn: ["APPROVED", "OPEN"] },
            },
        });
        await this.prisma.auditWorkspace.update({
            where: { id: workspace.id },
            data: { status: "REPORTING" },
        });
        for (const role of ["LEAD_AUDITOR", "AUDITOR"]) {
            await this.notifyAssignment(workspace.id, role, "WORKPAPER_SUBMITTED", "Assessment lapangan ditutup oleh tenggat", `${unresolved} butir belum mempunyai keputusan lapangan dan harus dicatat dalam laporan.`);
        }
        await this.app.log(undefined, "SYSTEM", "AUTO_FIELD_AUDIT_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { unresolved, overdue: true });
    }
    async closeReportingByDeadline(workspace) {
        const [unfinishedWorkpapers, draftFindings] = await Promise.all([
            this.prisma.workpaper.count({
                where: {
                    question: { workspaceId: workspace.id },
                    documentStatus: { in: ["DRAFT", "SUBMITTED", "RETURNED"] },
                },
            }),
            this.prisma.finding.count({
                where: {
                    workspaceId: workspace.id,
                    status: { in: ["DRAFT", "REVIEW"] },
                },
            }),
        ]);
        await this.prisma.auditWorkspace.update({
            where: { id: workspace.id },
            data: { status: "FOLLOW_UP" },
        });
        await this.notifyRoleUsers(workspace.id, "AUDITEE", "CORRECTIVE_ACTION_SUBMITTED", "Tahap tindak lanjut dibuka", `${workspace.unit.name}: tenggat pelaporan berakhir dengan ${unfinishedWorkpapers} kertas kerja dan ${draftFindings} temuan belum final.`, workspace.unitId);
        await this.app.log(undefined, "SYSTEM", "AUTO_REPORTING_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { unfinishedWorkpapers, draftFindings, overdue: true });
    }
    async closeFollowUpByDeadline(workspace) {
        const openFindings = await this.prisma.finding.count({
            where: {
                workspaceId: workspace.id,
                status: { notIn: ["CLOSED", "VOID"] },
            },
        });
        await this.prisma.auditWorkspace.update({
            where: { id: workspace.id },
            data: { status: "REPORT_REVIEW" },
        });
        await this.notifyRoleUsers(workspace.id, "ADMIN_MUTU", "VERIFICATION_REQUESTED", "Tenggat tindak lanjut berakhir", `${workspace.unit.name}: ${openFindings} temuan masih terbuka. Admin Mutu harus memeriksa sebelum penutupan audit.`);
        await this.app.log(undefined, "SYSTEM", "AUTO_FOLLOW_UP_DEADLINE", "AuditWorkspace", workspace.id, workspace.id, { openFindings, overdue: true });
    }
    async runDueTransitions() {
        if (this.running)
            return;
        this.running = true;
        try {
            const now = new Date();
            const plans = await this.prisma.auditUnitPlan.findMany({
                where: { workspaceId: { not: null } },
            });
            for (const plan of plans) {
                if (!plan.workspaceId)
                    continue;
                const workspace = await this.prisma.auditWorkspace.findUnique({
                    where: { id: plan.workspaceId },
                    include: { unit: true },
                });
                if (!workspace)
                    continue;
                if (["AUDITOR_REVIEW", "RETURNED"].includes(workspace.instrumentStatus) &&
                    this.deadlinePassed(plan.instrumentReviewEnd, now)) {
                    await this.fallbackToDefaultForVerification(workspace);
                    continue;
                }
                if (workspace.instrumentStatus === "PENDING_VERIFICATION" &&
                    this.deadlinePassed(plan.instrumentVerificationEnd, now)) {
                    await this.fallbackToDefaultApproval(workspace);
                    continue;
                }
                if (workspace.status === "SELF_ASSESSMENT" &&
                    this.deadlinePassed(plan.selfAssessmentEnd, now)) {
                    await this.closeSelfAssessmentByDeadline(workspace);
                    continue;
                }
                if (workspace.status === "DESK_REVIEW" &&
                    this.deadlinePassed(plan.selfAssessmentReviewEnd, now)) {
                    await this.closeDeskReviewByDeadline(workspace);
                    continue;
                }
                if (workspace.status === "FIELD_AUDIT" &&
                    this.deadlinePassed(plan.fieldAuditEnd, now)) {
                    await this.closeFieldAuditByDeadline(workspace);
                    continue;
                }
                if (workspace.status === "REPORTING" &&
                    this.deadlinePassed(plan.reportingEnd, now)) {
                    await this.closeReportingByDeadline(workspace);
                    continue;
                }
                if (workspace.status === "FOLLOW_UP" &&
                    this.deadlinePassed(plan.followUpEnd, now)) {
                    await this.closeFollowUpByDeadline(workspace);
                }
            }
        }
        catch (error) {
            console.error("Workflow automation failed", error);
        }
        finally {
            this.running = false;
        }
    }
};
exports.WorkflowAutomationService = WorkflowAutomationService;
exports.WorkflowAutomationService = WorkflowAutomationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_service_1.AppService])
], WorkflowAutomationService);
//# sourceMappingURL=workflow-automation.service.js.map