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
exports.AuditPlanningController = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const auth_1 = require("./auth");
const app_service_1 = require("./app.service");
const ami_workflow_service_1 = require("./ami-workflow.service");
function programInput(body, partial = false) {
    const code = body.code == null ? undefined : String(body.code).trim().toUpperCase();
    const name = body.name == null ? undefined : String(body.name).trim();
    const auditYear = body.auditYear == null ? undefined : Number(body.auditYear);
    const startDate = body.startDate == null ? undefined : new Date(body.startDate);
    const endDate = body.endDate == null ? undefined : new Date(body.endDate);
    if (!partial &&
        (!code || !name || auditYear == null || !startDate || !endDate)) {
        throw new common_1.BadRequestException("Kode, nama, tahun, tanggal mulai, dan tanggal selesai wajib diisi.");
    }
    if (auditYear != null &&
        (!Number.isInteger(auditYear) || auditYear < 2000 || auditYear > 2100)) {
        throw new common_1.BadRequestException("Tahun audit tidak valid.");
    }
    if (startDate && Number.isNaN(startDate.getTime())) {
        throw new common_1.BadRequestException("Tanggal mulai tidak valid.");
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
        throw new common_1.BadRequestException("Tanggal selesai tidak valid.");
    }
    if (startDate && endDate && endDate < startDate) {
        throw new common_1.BadRequestException("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
    }
    return { code, name, auditYear, startDate, endDate, status: body.status };
}
let AuditPlanningController = class AuditPlanningController {
    flow;
    app;
    constructor(flow, app) {
        this.flow = flow;
        this.app = app;
    }
    listPrograms() {
        return this.flow.prisma.auditProgram.findMany({
            include: { _count: { select: { workspaces: true } } },
            orderBy: { startDate: "desc" },
        });
    }
    createProgram(body) {
        const data = programInput(body);
        return this.flow.prisma.auditProgram.create({
            data: {
                code: data.code,
                name: data.name,
                auditYear: data.auditYear,
                startDate: data.startDate,
                endDate: data.endDate,
                status: data.status ?? "DRAFT",
            },
        });
    }
    async updateProgram(id, body, user) {
        const before = await this.flow.prisma.auditProgram.findUniqueOrThrow({
            where: { id },
        });
        this.flow.requireStatus(before.status, ["DRAFT", "PLANNED"]);
        const data = programInput(body, true);
        const effectiveStart = data.startDate ?? before.startDate;
        const effectiveEnd = data.endDate ?? before.endDate;
        if (effectiveEnd < effectiveStart) {
            throw new common_1.BadRequestException("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
        }
        const after = await this.flow.prisma.auditProgram.update({
            where: { id },
            data,
        });
        await this.flow.log(user.id, user.username, "AUDIT_PROGRAM_UPDATED", "AuditProgram", id, null, after, before);
        return after;
    }
    async deleteProgram(id, cascadeValue = "false", body, user) {
        const program = await this.flow.prisma.auditProgram.findUniqueOrThrow({
            where: { id },
            include: {
                workspaces: {
                    include: {
                        evidences: { select: { storageKey: true } },
                        printDocuments: { select: { storageKey: true } },
                    },
                },
            },
        });
        const cascade = cascadeValue === "true";
        if (program.workspaces.length && !cascade) {
            throw new common_1.BadRequestException(`Program mempunyai ${program.workspaces.length} ruang kerja. Gunakan konfirmasi hapus beserta transaksi.`);
        }
        if (cascade && body?.confirmation !== program.code) {
            throw new common_1.BadRequestException(`Ketik kode program ${program.code} sebagai konfirmasi penghapusan.`);
        }
        const workspaceIds = program.workspaces.map((workspace) => workspace.id);
        const storageKeys = program.workspaces.flatMap((workspace) => [
            ...workspace.evidences.map((item) => item.storageKey),
            ...workspace.printDocuments.map((item) => item.storageKey),
        ]);
        await this.flow.prisma.$transaction(async (transaction) => {
            if (workspaceIds.length) {
                await transaction.verification.deleteMany({
                    where: { action: { workspaceId: { in: workspaceIds } } },
                });
                await transaction.correctiveAction.deleteMany({
                    where: { workspaceId: { in: workspaceIds } },
                });
                await transaction.finding.deleteMany({
                    where: { workspaceId: { in: workspaceIds } },
                });
                await transaction.evidence.deleteMany({
                    where: { workspaceId: { in: workspaceIds } },
                });
                await transaction.printDocument.deleteMany({
                    where: { workspaceId: { in: workspaceIds } },
                });
                await transaction.notification.deleteMany({
                    where: { workspaceId: { in: workspaceIds } },
                });
                await transaction.activityLog.deleteMany({
                    where: { workspaceId: { in: workspaceIds } },
                });
                await transaction.auditWorkspace.deleteMany({
                    where: { id: { in: workspaceIds } },
                });
            }
            await transaction.auditProgram.delete({ where: { id } });
        });
        const storageRoot = (0, node_path_1.resolve)(process.cwd(), "storage");
        for (const storageKey of storageKeys) {
            const target = (0, node_path_1.resolve)(process.cwd(), storageKey);
            if (target.startsWith(storageRoot))
                await (0, promises_1.unlink)(target).catch(() => undefined);
        }
        await this.flow.log(user.id, user.username, "AUDIT_PROGRAM_DELETED", "AuditProgram", id, null, { code: program.code, deletedWorkspaces: workspaceIds.length });
        return { ok: true, deletedWorkspaces: workspaceIds.length };
    }
    listWorkspaces(user) {
        return this.flow.prisma.auditWorkspace.findMany({
            where: this.flow.isGlobal(user)
                ? {}
                : {
                    OR: [
                        { unitId: user.unitId ?? "_" },
                        { team: { some: { userId: user.id } } },
                    ],
                },
            include: {
                unit: true,
                program: true,
                team: {
                    include: {
                        user: { select: { id: true, username: true, fullName: true } },
                    },
                },
                _count: {
                    select: { questions: true, findings: true, evidences: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    createWorkspace(body, user) {
        return this.app.createWorkspace(body, user);
    }
    oneWorkspace(id, user) {
        return this.flow.workspace(id, user);
    }
    async deleteWorkspace(id, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.status, ["DRAFT", "FILE_PREPARATION"]);
        await this.flow.prisma.auditWorkspace.delete({ where: { id } });
        return { ok: true };
    }
    generateInstrument(id, user) {
        return this.app.generateInstrument(id, user);
    }
    async questions(id, user, pageValue = "1", limitValue = "25") {
        await this.flow.workspace(id, user);
        const page = Math.max(1, Number(pageValue));
        const take = Math.min(100, Math.max(10, Number(limitValue)));
        const auditeeOnly = user.roleCodes.includes("AUDITEE") &&
            !this.flow.hasRole(user, [
                "AUDITOR",
                "KETUA_AUDITOR",
                "ADMIN_MUTU",
                "SUPER_ADMIN",
            ]);
        const where = {
            workspaceId: id,
            ...(auditeeOnly ? { reviewStatus: "PUBLISHED", excluded: false } : {}),
        };
        const [data, total] = await Promise.all([
            this.flow.prisma.auditQuestion.findMany({
                where,
                include: {
                    assessment: true,
                    masterQuestion: { include: { standard: true, isoClause: true } },
                },
                orderBy: { sortOrder: "asc" },
                skip: (page - 1) * take,
                take,
            }),
            this.flow.prisma.auditQuestion.count({ where }),
        ]);
        return { data, total, page, limit: take };
    }
    async detail(id, user) {
        const workspace = await this.flow.workspace(id, user);
        const auditeeOnly = user.roleCodes.includes("AUDITEE") &&
            !this.flow.hasRole(user, [
                "AUDITOR",
                "KETUA_AUDITOR",
                "ADMIN_MUTU",
                "SUPER_ADMIN",
            ]);
        const [questions, evidences, workpapers, findings, actions, prints, users, availableInstrumentCount,] = await Promise.all([
            this.flow.prisma.auditQuestion.findMany({
                where: {
                    workspaceId: id,
                    ...(auditeeOnly
                        ? { reviewStatus: "PUBLISHED", excluded: false }
                        : {}),
                },
                include: {
                    assessment: true,
                    masterQuestion: { include: { standard: true, isoClause: true } },
                    instrumentReviews: { orderBy: { createdAt: "desc" } },
                },
                orderBy: { sortOrder: "asc" },
            }),
            this.flow.prisma.evidence.findMany({
                where: { workspaceId: id, deletedAt: null },
                include: {
                    uploadedBy: { select: { fullName: true } },
                    auditQuestion: true,
                },
                orderBy: { uploadedAt: "desc" },
            }),
            auditeeOnly
                ? []
                : this.flow.prisma.workpaper.findMany({
                    where: { question: { workspaceId: id } },
                    include: {
                        auditor: { select: { fullName: true } },
                        question: true,
                    },
                }),
            this.flow.prisma.finding.findMany({
                where: { workspaceId: id },
                include: { actions: { include: { verifications: true } } },
            }),
            this.flow.prisma.correctiveAction.findMany({
                where: { workspaceId: id },
                include: { finding: true, verifications: true },
            }),
            this.flow.prisma.printDocument.findMany({
                where: { workspaceId: id },
                orderBy: { createdAt: "desc" },
            }),
            this.flow.prisma.user.findMany({
                where: {
                    status: "ACTIVE",
                    roles: {
                        some: {
                            role: {
                                code: { in: ["AUDITOR", "KETUA_AUDITOR", "VERIFIKATOR"] },
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
            this.flow.prisma.masterQuestion.count({
                where: {
                    active: true,
                    unitMaps: { some: { unitId: workspace.unitId } },
                },
            }),
        ]);
        return {
            workspace,
            questions,
            evidences,
            workpapers,
            findings,
            actions,
            prints,
            users,
            availableInstrumentCount,
        };
    }
    async addTeam(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.status, [
            "DRAFT",
            "FILE_PREPARATION",
            "INSTRUMENT_REVIEW",
        ]);
        const member = await this.flow.prisma.user.findUniqueOrThrow({
            where: { id: body.userId },
            include: { roles: { include: { role: true } } },
        });
        const roleCodes = member.roles.map((item) => item.role.code);
        const assignmentRole = body.role === "KETUA_AUDITOR" ? "LEAD_AUDITOR" : body.role;
        const requiredSystemRoles = {
            LEAD_AUDITOR: ["KETUA_AUDITOR"],
            AUDITOR: ["AUDITOR", "KETUA_AUDITOR"],
            VERIFIER: ["VERIFIKATOR"],
        };
        if (!requiredSystemRoles[assignmentRole]?.some((role) => roleCodes.includes(role))) {
            throw new common_1.BadRequestException("Role sistem personel tidak sesuai penugasan.");
        }
        if (member.unitId === workspace.unitId) {
            throw new common_1.BadRequestException("Konflik kepentingan: personel berasal dari unit auditee.");
        }
        const existingOtherRole = await this.flow.prisma.auditTeam.findFirst({
            where: { workspaceId: id, userId: member.id },
        });
        if (existingOtherRole && existingOtherRole.role !== assignmentRole) {
            throw new common_1.BadRequestException("Personel sudah mempunyai penugasan lain pada workspace ini.");
        }
        return this.flow.prisma.auditTeam.upsert({
            where: {
                workspaceId_userId_role: {
                    workspaceId: id,
                    userId: member.id,
                    role: assignmentRole,
                },
            },
            create: { workspaceId: id, userId: member.id, role: assignmentRole },
            update: {},
        });
    }
    async removeTeam(id, teamId, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireStatus(workspace.status, [
            "DRAFT",
            "FILE_PREPARATION",
            "INSTRUMENT_REVIEW",
        ]);
        const assignment = await this.flow.prisma.auditTeam.findUniqueOrThrow({
            where: { id: teamId },
        });
        if (assignment.workspaceId !== id) {
            throw new common_1.BadRequestException("Penugasan tidak berasal dari ruang kerja ini.");
        }
        await this.flow.prisma.auditTeam.delete({ where: { id: teamId } });
        return { ok: true };
    }
};
exports.AuditPlanningController = AuditPlanningController;
__decorate([
    (0, common_1.Get)("audit-programs"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditPlanningController.prototype, "listPrograms", null);
__decorate([
    (0, common_1.Post)("audit-programs"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditPlanningController.prototype, "createProgram", null);
__decorate([
    (0, common_1.Patch)("audit-programs/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "updateProgram", null);
__decorate([
    (0, common_1.Delete)("audit-programs/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("cascade")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "deleteProgram", null);
__decorate([
    (0, common_1.Get)("audit-workspaces"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditPlanningController.prototype, "listWorkspaces", null);
__decorate([
    (0, common_1.Post)("audit-workspaces"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuditPlanningController.prototype, "createWorkspace", null);
__decorate([
    (0, common_1.Get)("audit-workspaces/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuditPlanningController.prototype, "oneWorkspace", null);
__decorate([
    (0, common_1.Delete)("audit-workspaces/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "deleteWorkspace", null);
__decorate([
    (0, common_1.Post)("audit-workspaces/:id/generate-instrument"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuditPlanningController.prototype, "generateInstrument", null);
__decorate([
    (0, common_1.Get)("audit-workspaces/:id/questions"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __param(2, (0, common_1.Query)("page")),
    __param(3, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "questions", null);
__decorate([
    (0, common_1.Get)("audit-flow/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)("audit-flow/workspaces/:id/team"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "addTeam", null);
__decorate([
    (0, common_1.Delete)("audit-flow/workspaces/:id/team/:teamId"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Param)("teamId")),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AuditPlanningController.prototype, "removeTeam", null);
exports.AuditPlanningController = AuditPlanningController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        app_service_1.AppService])
], AuditPlanningController);
//# sourceMappingURL=audit-planning.controller.js.map