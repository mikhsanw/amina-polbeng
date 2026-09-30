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
exports.AmiWorkflowService = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
let AmiWorkflowService = class AmiWorkflowService {
    prisma;
    app;
    constructor(prisma, app) {
        this.prisma = prisma;
        this.app = app;
    }
    isGlobal(user) {
        return user.roleCodes.some((role) => ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"].includes(role));
    }
    hasRole(user, roles) {
        return user.roleCodes.some((role) => roles.includes(role));
    }
    requireStatus(status, allowed) {
        if (!allowed.includes(status)) {
            throw new common_1.BadRequestException(`Data terkunci pada status ${status}. Tahap yang diperbolehkan: ${allowed.join(", ")}.`);
        }
    }
    async workspace(id, user) {
        const workspace = await this.prisma.auditWorkspace.findUniqueOrThrow({
            where: { id },
            include: {
                unit: true,
                program: true,
                team: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                                unitId: true,
                                isUnitApprover: true,
                                unit: { select: { code: true, name: true } },
                                roles: { include: { role: true } },
                            },
                        },
                    },
                },
                _count: {
                    select: { questions: true, evidences: true, findings: true, actions: true },
                },
            },
        });
        if (!this.isGlobal(user) &&
            workspace.unitId !== user.unitId &&
            !workspace.team.some((member) => member.userId === user.id)) {
            throw new common_1.ForbiddenException("Anda tidak ditugaskan pada audit ini.");
        }
        return workspace;
    }
    requireAssignment(workspace, user, roles) {
        if (!workspace.team.some((member) => member.userId === user.id && roles.includes(member.role))) {
            throw new common_1.ForbiddenException("Pengguna tidak mempunyai penugasan yang sesuai pada workspace ini.");
        }
    }
    questionDefault(question) {
        return {
            question: question.defaultQuestion ?? question.questionSnapshot,
            expectedEvidence: question.defaultExpectedEvidence,
            testMethod: question.defaultTestMethod,
            riskLevel: question.defaultRiskLevel,
            excluded: false,
        };
    }
    questionProposal(question) {
        return {
            question: question.auditorQuestion ?? question.defaultQuestion,
            expectedEvidence: question.auditorExpectedEvidence ?? question.defaultExpectedEvidence,
            testMethod: question.auditorTestMethod ?? question.defaultTestMethod,
            riskLevel: question.auditorRiskLevel ?? question.defaultRiskLevel,
            excluded: question.excluded,
            exclusionReason: question.exclusionReason,
        };
    }
    async notifyRole(workspaceId, assignmentRole, event, title, message, entityType, entityId) {
        const recipients = await this.prisma.auditTeam.findMany({
            where: { workspaceId, role: assignmentRole },
            select: { userId: true },
        });
        if (!recipients.length)
            return;
        await this.prisma.notification.createMany({
            data: recipients.map((recipient) => ({
                workspaceId,
                recipientUserId: recipient.userId,
                event,
                title,
                message,
                entityType,
                entityId,
            })),
        });
    }
    async publishInstrument(workspaceId, user, note) {
        const questions = await this.prisma.auditQuestion.findMany({
            where: { workspaceId },
        });
        if (!questions.length) {
            throw new common_1.BadRequestException("Instrumen belum dibentuk.");
        }
        await this.prisma.$transaction([
            ...questions.map((question) => this.prisma.auditQuestion.update({
                where: { id: question.id },
                data: {
                    publishedQuestion: question.auditorQuestion ?? question.defaultQuestion,
                    publishedExpectedEvidence: question.auditorExpectedEvidence ?? question.defaultExpectedEvidence,
                    publishedTestMethod: question.auditorTestMethod ?? question.defaultTestMethod,
                    publishedRiskLevel: question.auditorRiskLevel ?? question.defaultRiskLevel,
                    questionSnapshot: question.auditorQuestion ?? question.defaultQuestion,
                    reviewStatus: "PUBLISHED",
                    approvedById: user.id,
                    approvedAt: new Date(),
                },
            })),
            ...questions
                .filter((question) => !question.excluded)
                .map((question) => this.prisma.selfAssessment.upsert({
                where: { auditQuestionId: question.id },
                create: {
                    auditQuestionId: question.id,
                    responseStatus: "NOT_STARTED",
                },
                update: {},
            })),
            this.prisma.auditWorkspace.update({
                where: { id: workspaceId },
                data: {
                    instrumentStatus: "PUBLISHED",
                    status: "SELF_ASSESSMENT",
                },
            }),
        ]);
        await this.app.log(user.id, user.username, "INSTRUMENT_PUBLISHED", "AuditWorkspace", workspaceId, workspaceId, { note, count: questions.filter((question) => !question.excluded).length });
        return { ok: true, count: questions.length };
    }
    log(...args) {
        return this.app.log(...args);
    }
};
exports.AmiWorkflowService = AmiWorkflowService;
exports.AmiWorkflowService = AmiWorkflowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_service_1.AppService])
], AmiWorkflowService);
//# sourceMappingURL=ami-workflow.service.js.map