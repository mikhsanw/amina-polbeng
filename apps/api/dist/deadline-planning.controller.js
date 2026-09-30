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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadlinePlanningController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
function optionalDate(value) {
    if (value == null || value === "")
        return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        throw new common_1.BadRequestException(`Tanggal ${String(value)} tidak valid.`);
    }
    return date;
}
function uniqueStrings(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}
function systemRoles(user) {
    return (user.roles || []).map((item) => String(item.role.code));
}
let DeadlinePlanningController = class DeadlinePlanningController {
    prisma;
    app;
    constructor(prisma, app) {
        this.prisma = prisma;
        this.app = app;
    }
    async detail(programId, planId) {
        const plan = await this.prisma.auditUnitPlan.findUniqueOrThrow({
            where: { id: planId },
        });
        if (plan.programId !== programId) {
            throw new common_1.BadRequestException("Rencana unit tidak berasal dari program ini.");
        }
        const [program, unit, assignments, links, workspace] = await Promise.all([
            this.prisma.auditProgram.findUniqueOrThrow({ where: { id: programId } }),
            this.prisma.unit.findUniqueOrThrow({ where: { id: plan.unitId } }),
            this.prisma.auditUnitPlanAssignment.findMany({ where: { planId } }),
            this.prisma.auditUnitPlanQuestion.findMany({ where: { planId } }),
            plan.workspaceId
                ? this.prisma.auditWorkspace.findUnique({ where: { id: plan.workspaceId } })
                : null,
        ]);
        const questionIds = links.map((item) => item.questionId);
        const questions = questionIds.length
            ? await this.prisma.masterQuestion.findMany({
                where: { id: { in: questionIds }, active: true },
            })
            : [];
        return { ...plan, program, unit, assignments, questions, workspace };
    }
    ready(plan) {
        return (plan.included &&
            !plan.workspaceId &&
            plan.questions.length > 0 &&
            plan.assignments.some((item) => item.role === "LEAD_AUDITOR") &&
            plan.assignments.some((item) => item.role === "AUDITOR") &&
            plan.assignments.some((item) => item.role === "VERIFIER") &&
            Boolean(plan.instrumentReviewEnd) &&
            Boolean(plan.instrumentVerificationEnd));
    }
    validateDeadline(date, program, label) {
        if (!date)
            return;
        const start = new Date(program.startDate);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(program.endDate);
        end.setUTCHours(23, 59, 59, 999);
        const deadline = new Date(date);
        deadline.setUTCHours(23, 59, 59, 999);
        if (deadline.getTime() < start.getTime() || deadline.getTime() > end.getTime()) {
            throw new common_1.BadRequestException(`${label} harus berada dalam rentang program audit.`);
        }
    }
    async save(programId, planId, body, user) {
        const before = await this.detail(programId, planId);
        if (before.workspaceId) {
            throw new common_1.BadRequestException("Ruang kerja telah dibentuk. Rencana awal tidak dapat diubah dari matriks.");
        }
        const included = body.included !== false;
        const instrumentReviewEnd = optionalDate(body.instrumentReviewEnd);
        const instrumentVerificationEnd = optionalDate(body.instrumentVerificationEnd);
        this.validateDeadline(instrumentReviewEnd, before.program, "Batas submit telaah instrumen");
        this.validateDeadline(instrumentVerificationEnd, before.program, "Batas keputusan Verifikator");
        if (instrumentReviewEnd &&
            instrumentVerificationEnd &&
            instrumentVerificationEnd.getTime() < instrumentReviewEnd.getTime()) {
            throw new common_1.BadRequestException("Batas keputusan Verifikator tidak boleh lebih awal dari batas submit telaah.");
        }
        const leadAuditorId = String(body.leadAuditorId || "").trim() || null;
        const verifierId = String(body.verifierId || "").trim() || null;
        const auditorIds = uniqueStrings(body.auditorIds);
        const assignmentIds = [leadAuditorId, verifierId, ...auditorIds].filter((item) => Boolean(item));
        if (new Set(assignmentIds).size !== assignmentIds.length) {
            throw new common_1.BadRequestException("Satu pengguna tidak boleh memegang lebih dari satu peran pada unit yang sama.");
        }
        const users = assignmentIds.length
            ? await this.prisma.user.findMany({
                where: { id: { in: assignmentIds }, status: "ACTIVE", deletedAt: null },
                include: { roles: { include: { role: true } } },
            })
            : [];
        if (users.length !== assignmentIds.length) {
            throw new common_1.BadRequestException("Personel tidak aktif atau tidak ditemukan.");
        }
        const usersById = new Map(users.map((item) => [item.id, item]));
        const validatePerson = (id, allowed, label) => {
            if (!id)
                return;
            const selected = usersById.get(id);
            if (!selected || !allowed.some((role) => systemRoles(selected).includes(role))) {
                throw new common_1.BadRequestException(`${label} tidak memiliki role yang sesuai.`);
            }
            if (selected.unitId === before.unitId) {
                throw new common_1.BadRequestException(`${label} berasal dari unit Auditee dan menimbulkan konflik kepentingan.`);
            }
        };
        validatePerson(leadAuditorId, ["KETUA_AUDITOR"], "Ketua Auditor");
        validatePerson(verifierId, ["VERIFIKATOR"], "Verifikator");
        for (const auditorId of auditorIds) {
            validatePerson(auditorId, ["AUDITOR", "KETUA_AUDITOR"], "Auditor");
        }
        const questionIds = uniqueStrings(body.questionIds);
        if (questionIds.length) {
            const valid = await this.prisma.masterQuestion.count({
                where: { id: { in: questionIds }, active: true },
            });
            if (valid !== questionIds.length) {
                throw new common_1.BadRequestException("Sebagian instrumen tidak aktif atau tidak ditemukan.");
            }
        }
        await this.prisma.$transaction(async (transaction) => {
            await transaction.auditUnitPlan.update({
                where: { id: planId },
                data: {
                    included,
                    status: included ? "DRAFT" : "EXCLUDED",
                    instrumentReviewStart: null,
                    instrumentReviewEnd,
                    instrumentVerificationStart: null,
                    instrumentVerificationEnd,
                },
            });
            await transaction.auditUnitPlanAssignment.deleteMany({ where: { planId } });
            const assignments = [
                ...(leadAuditorId
                    ? [{ planId, userId: leadAuditorId, role: "LEAD_AUDITOR" }]
                    : []),
                ...auditorIds.map((userId) => ({ planId, userId, role: "AUDITOR" })),
                ...(verifierId
                    ? [{ planId, userId: verifierId, role: "VERIFIER" }]
                    : []),
            ];
            if (assignments.length) {
                await transaction.auditUnitPlanAssignment.createMany({ data: assignments });
            }
            await transaction.auditUnitPlanQuestion.deleteMany({ where: { planId } });
            if (questionIds.length) {
                await transaction.auditUnitPlanQuestion.createMany({
                    data: questionIds.map((questionId) => ({ planId, questionId })),
                });
            }
        });
        const saved = await this.detail(programId, planId);
        const status = !saved.included
            ? "EXCLUDED"
            : this.ready(saved)
                ? "READY"
                : "DRAFT";
        const after = await this.prisma.auditUnitPlan.update({
            where: { id: planId },
            data: { status },
        });
        await this.app.log(user.id, user.username, "AUDIT_UNIT_DEADLINE_PLAN_SAVED", "AuditUnitPlan", planId, null, after, before);
        return { ...after, ready: status === "READY" };
    }
    async createWorkspace(programId, planId, user) {
        const plan = await this.detail(programId, planId);
        if (!plan.included) {
            throw new common_1.BadRequestException("Unit tidak dimasukkan sebagai target audit.");
        }
        if (plan.workspace)
            return plan.workspace;
        if (!this.ready(plan)) {
            throw new common_1.BadRequestException("Rencana belum lengkap. Tetapkan instrumen, Ketua Auditor, Auditor, Verifikator, batas submit telaah, dan batas keputusan Verifikator.");
        }
        const existing = await this.prisma.auditWorkspace.findUnique({
            where: {
                unitId_auditYear: {
                    unitId: plan.unitId,
                    auditYear: plan.program.auditYear,
                },
            },
        });
        if (existing) {
            if (existing.programId !== programId) {
                throw new common_1.BadRequestException("Unit sudah mempunyai ruang kerja pada tahun audit yang sama.");
            }
            await this.prisma.auditUnitPlan.update({
                where: { id: planId },
                data: { workspaceId: existing.id, status: "WORKSPACE_CREATED" },
            });
            return existing;
        }
        const questions = [...plan.questions].sort((a, b) => `${a.moduleCode}:${a.code}`.localeCompare(`${b.moduleCode}:${b.code}`));
        const workspace = await this.prisma.$transaction(async (transaction) => {
            const created = await transaction.auditWorkspace.create({
                data: {
                    unitId: plan.unitId,
                    auditYear: plan.program.auditYear,
                    programId,
                    name: `${plan.unit.slug}_${plan.program.auditYear}`,
                    status: "INSTRUMENT_REVIEW",
                    instrumentStatus: "AUDITOR_REVIEW",
                    team: {
                        create: plan.assignments.map((assignment) => ({
                            userId: assignment.userId,
                            role: assignment.role,
                        })),
                    },
                    questions: {
                        create: questions.map((question, index) => ({
                            masterQuestionId: question.id,
                            dimension: question.dimension,
                            questionSnapshot: question.question,
                            defaultQuestion: question.question,
                            moduleCode: question.moduleCode,
                            defaultExpectedEvidence: question.expectedEvidence,
                            defaultTestMethod: question.testMethod,
                            defaultRiskLevel: question.riskLevel,
                            required: question.required,
                            weight: question.weight,
                            defaultWeight: question.weight,
                            sortOrder: index + 1,
                            reviewStatus: "AUDITOR_REVIEW",
                        })),
                    },
                },
            });
            await transaction.auditUnitPlan.update({
                where: { id: planId },
                data: { workspaceId: created.id, status: "WORKSPACE_CREATED" },
            });
            return created;
        });
        await this.app.log(user.id, user.username, "AUDIT_WORKSPACE_CREATED_FROM_DEADLINE_PLAN", "AuditWorkspace", workspace.id, workspace.id, { programId, planId, unitId: plan.unitId, instrumentCount: questions.length });
        return workspace;
    }
};
exports.DeadlinePlanningController = DeadlinePlanningController;
__decorate([
    (0, common_1.Put)(":planId"),
    __param(0, (0, common_1.Param)("programId")),
    __param(1, (0, common_1.Param)("planId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeadlinePlanningController.prototype, "save", null);
__decorate([
    (0, common_1.Post)(":planId/workspace"),
    __param(0, (0, common_1.Param)("programId")),
    __param(1, (0, common_1.Param)("planId")),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DeadlinePlanningController.prototype, "createWorkspace", null);
exports.DeadlinePlanningController = DeadlinePlanningController = __decorate([
    (0, common_1.Controller)("audit-programs/:programId/deadline-unit-plans"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_service_1.AppService])
], DeadlinePlanningController);
//# sourceMappingURL=deadline-planning.controller.js.map