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
exports.DeadlinePlanningMatrixController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const prisma_service_1 = require("./prisma.service");
let DeadlinePlanningMatrixController = class DeadlinePlanningMatrixController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    ready(plan) {
        const assignments = plan.assignments || [];
        return (plan.included &&
            !plan.workspaceId &&
            Number(plan.questionCount || 0) > 0 &&
            assignments.some((item) => item.role === "LEAD_AUDITOR") &&
            assignments.some((item) => item.role === "AUDITOR") &&
            assignments.some((item) => item.role === "VERIFIER") &&
            Boolean(plan.instrumentReviewEnd) &&
            Boolean(plan.instrumentVerificationEnd));
    }
    async matrix(programId) {
        const [program, units, existing] = await Promise.all([
            this.prisma.auditProgram.findUniqueOrThrow({ where: { id: programId } }),
            this.prisma.unit.findMany({
                where: { active: true },
                orderBy: [{ code: "asc" }, { name: "asc" }],
            }),
            this.prisma.auditUnitPlan.findMany({
                where: { programId },
                select: { unitId: true },
            }),
        ]);
        const existingUnitIds = new Set(existing.map((item) => item.unitId));
        for (const unit of units) {
            if (existingUnitIds.has(unit.id))
                continue;
            const defaults = await this.prisma.masterQuestion.findMany({
                where: { active: true, unitMaps: { some: { unitId: unit.id } } },
                select: { id: true },
            });
            const plan = await this.prisma.auditUnitPlan.create({
                data: { programId, unitId: unit.id },
            });
            if (defaults.length) {
                await this.prisma.auditUnitPlanQuestion.createMany({
                    data: defaults.map((question) => ({
                        planId: plan.id,
                        questionId: question.id,
                    })),
                });
            }
        }
        const plans = await this.prisma.auditUnitPlan.findMany({
            where: { programId },
            orderBy: { createdAt: "asc" },
        });
        const planIds = plans.map((item) => item.id);
        const unitIds = plans.map((item) => item.unitId);
        const workspaceIds = plans
            .map((item) => item.workspaceId)
            .filter((item) => Boolean(item));
        const [planUnits, assignments, questionLinks, workspaces, candidates, defaultMaps,] = await Promise.all([
            this.prisma.unit.findMany({ where: { id: { in: unitIds } } }),
            planIds.length
                ? this.prisma.auditUnitPlanAssignment.findMany({
                    where: { planId: { in: planIds } },
                    orderBy: { role: "asc" },
                })
                : [],
            planIds.length
                ? this.prisma.auditUnitPlanQuestion.findMany({
                    where: { planId: { in: planIds } },
                })
                : [],
            workspaceIds.length
                ? this.prisma.auditWorkspace.findMany({
                    where: { id: { in: workspaceIds } },
                    select: {
                        id: true,
                        status: true,
                        instrumentStatus: true,
                        updatedAt: true,
                    },
                })
                : [],
            this.prisma.user.findMany({
                where: {
                    status: "ACTIVE",
                    deletedAt: null,
                    roles: {
                        some: {
                            role: {
                                code: {
                                    in: ["AUDITOR", "KETUA_AUDITOR", "VERIFIKATOR"],
                                },
                            },
                        },
                    },
                },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    unitId: true,
                    unit: { select: { code: true, name: true } },
                    roles: { include: { role: true } },
                },
                orderBy: { fullName: "asc" },
            }),
            this.prisma.questionUnitMap.findMany({
                where: { question: { active: true } },
                select: { unitId: true },
            }),
        ]);
        const assignedUserIds = [
            ...new Set(assignments.map((item) => item.userId)),
        ];
        const assignedUsers = assignedUserIds.length
            ? await this.prisma.user.findMany({
                where: { id: { in: assignedUserIds } },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    unitId: true,
                    unit: { select: { code: true, name: true } },
                },
            })
            : [];
        const unitsById = new Map(planUnits.map((item) => [item.id, item]));
        const workspacesById = new Map(workspaces.map((item) => [item.id, item]));
        const usersById = new Map(assignedUsers.map((item) => [item.id, item]));
        const assignmentsByPlan = new Map();
        for (const assignment of assignments) {
            const rows = assignmentsByPlan.get(assignment.planId) || [];
            rows.push({ ...assignment, user: usersById.get(assignment.userId) });
            assignmentsByPlan.set(assignment.planId, rows);
        }
        const questionCountByPlan = new Map();
        for (const link of questionLinks) {
            questionCountByPlan.set(link.planId, (questionCountByPlan.get(link.planId) || 0) + 1);
        }
        const defaultCountByUnit = new Map();
        for (const mapping of defaultMaps) {
            defaultCountByUnit.set(mapping.unitId, (defaultCountByUnit.get(mapping.unitId) || 0) + 1);
        }
        const detailed = plans
            .map((plan) => {
            const questionCount = questionCountByPlan.get(plan.id) || 0;
            const row = {
                ...plan,
                unit: unitsById.get(plan.unitId),
                assignments: assignmentsByPlan.get(plan.id) || [],
                questionCount,
                defaultInstrumentCount: defaultCountByUnit.get(plan.unitId) || 0,
                _count: { questions: questionCount },
                workspace: plan.workspaceId
                    ? workspacesById.get(plan.workspaceId)
                    : null,
            };
            return { ...row, ready: this.ready(row) };
        })
            .sort((a, b) => `${a.unit?.code || ""}-${a.unit?.name || ""}`.localeCompare(`${b.unit?.code || ""}-${b.unit?.name || ""}`));
        return {
            program,
            candidates: candidates.map((candidate) => ({
                ...candidate,
                roles: candidate.roles.map((item) => item.role.code),
            })),
            plans: detailed,
        };
    }
};
exports.DeadlinePlanningMatrixController = DeadlinePlanningMatrixController;
__decorate([
    (0, common_1.Get)("matrix"),
    __param(0, (0, common_1.Param)("programId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeadlinePlanningMatrixController.prototype, "matrix", null);
exports.DeadlinePlanningMatrixController = DeadlinePlanningMatrixController = __decorate([
    (0, common_1.Controller)("audit-programs/:programId/unit-plans"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DeadlinePlanningMatrixController);
//# sourceMappingURL=deadline-planning-matrix.controller.js.map