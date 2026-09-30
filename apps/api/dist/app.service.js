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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const argon2_1 = __importDefault(require("argon2"));
const auth_1 = require("./auth");
let AppService = class AppService {
    p;
    constructor(p) {
        this.p = p;
    }
    async login(username, password, ip, ua) {
        const user = await this.p.user.findUnique({
            where: { username },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: { include: { permission: true } },
                            },
                        },
                    },
                },
                unit: true,
            },
        });
        if (!user ||
            user.status !== "ACTIVE" ||
            (user.lockedUntil && user.lockedUntil > new Date()) ||
            !(await argon2_1.default.verify(user.passwordHash, password))) {
            if (user) {
                const attempts = user.failedLoginAttempts + 1;
                await this.p.user.update({
                    where: { id: user.id },
                    data: {
                        failedLoginAttempts: attempts,
                        lockedUntil: attempts >= Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5)
                            ? new Date(Date.now() +
                                Number(process.env.ACCOUNT_LOCK_MINUTES ?? 15) * 60_000)
                            : null,
                    },
                });
            }
            throw new common_1.UnauthorizedException("Username atau password salah");
        }
        await this.p.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
        });
        const token = (0, auth_1.newToken)();
        const hours = Number(process.env.SESSION_TTL_HOURS ?? 8);
        await this.p.session.create({
            data: {
                tokenHash: (0, auth_1.tokenHash)(token),
                userId: user.id,
                expiresAt: new Date(Date.now() + hours * 3_600_000),
                ipAddress: ip,
                userAgent: ua,
            },
        });
        await this.log(user.id, user.username, "LOGIN_SUCCESS", "Session", null, null);
        const roleCodes = user.roles.map((item) => item.role.code);
        const permissions = new Set();
        for (const item of user.roles) {
            for (const mapping of item.role.permissions) {
                permissions.add(mapping.permission.code);
            }
        }
        return {
            token,
            hours,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                mustChangePassword: user.mustChangePassword,
                roles: roleCodes,
                permissions: [...permissions],
                unit: user.unit,
                unitId: user.unitId,
                isUnitApprover: user.isUnitApprover,
            },
        };
    }
    async log(userId, username, action, entityType, entityId, workspaceId, newValue, oldValue) {
        await this.p.activityLog.create({
            data: {
                userId,
                username,
                action,
                entityType,
                entityId,
                workspaceId,
                newValue: newValue,
                oldValue: oldValue,
                result: "SUCCESS",
            },
        });
    }
    async createWorkspace(data, user) {
        const auditYear = Number(data.auditYear);
        if (!Number.isInteger(auditYear) || auditYear < 2000 || auditYear > 2100) {
            throw new common_1.BadRequestException("Tahun audit tidak valid");
        }
        if (!data.programId) {
            throw new common_1.BadRequestException("Rencana audit wajib dipilih");
        }
        const [unit, program] = await Promise.all([
            this.p.unit.findUnique({ where: { id: data.unitId } }),
            this.p.auditProgram.findUnique({ where: { id: data.programId } }),
        ]);
        if (!unit)
            throw new common_1.BadRequestException("Unit tidak ditemukan");
        if (!program)
            throw new common_1.BadRequestException("Rencana audit tidak ditemukan");
        if (program.auditYear !== auditYear) {
            throw new common_1.BadRequestException(`Tahun transaksi harus sama dengan tahun rencana (${program.auditYear})`);
        }
        const duplicate = await this.p.auditWorkspace.findUnique({
            where: { unitId_auditYear: { unitId: unit.id, auditYear } },
        });
        if (duplicate) {
            await this.log(user.id, user.username, "OPEN_EXISTING", "AuditWorkspace", duplicate.id, duplicate.id, { unitId: unit.id, auditYear, requestedProgramId: program.id });
            return duplicate;
        }
        const mappedQuestionCount = await this.p.masterQuestion.count({
            where: { active: true, unitMaps: { some: { unitId: unit.id } } },
        });
        if (!mappedQuestionCount) {
            throw new common_1.BadRequestException(`Unit ${unit.name} belum memiliki instrumen default. Impor dan petakan bank instrumen terlebih dahulu.`);
        }
        const workspace = await this.p.auditWorkspace.create({
            data: {
                unitId: unit.id,
                auditYear,
                programId: program.id,
                name: `${unit.slug}_${auditYear}`,
                status: "FILE_PREPARATION",
                instrumentStatus: "GENERATED",
            },
        });
        await this.log(user.id, user.username, "AUDIT_WORKSPACE_CREATED", "AuditWorkspace", workspace.id, workspace.id, workspace);
        return workspace;
    }
    async generateInstrument(workspaceId, user) {
        const workspace = await this.p.auditWorkspace.findUniqueOrThrow({
            where: { id: workspaceId },
            include: { unit: true, team: true },
        });
        if (!["FILE_PREPARATION", "INSTRUMENT_REVIEW"].includes(workspace.status)) {
            throw new common_1.BadRequestException(`Instrumen tidak dapat dibentuk pada tahap ${workspace.status}.`);
        }
        const requiredAssignments = ["LEAD_AUDITOR", "AUDITOR", "VERIFIER"];
        const missing = requiredAssignments.filter((role) => !workspace.team.some((member) => member.role === role));
        if (missing.length) {
            throw new common_1.BadRequestException(`Tim audit belum lengkap. Penugasan yang belum tersedia: ${missing.join(", ")}.`);
        }
        const questions = await this.p.masterQuestion.findMany({
            where: {
                active: true,
                unitMaps: { some: { unitId: workspace.unitId } },
            },
            orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
        });
        if (!questions.length) {
            throw new common_1.BadRequestException(`Belum ada instrumen default untuk ${workspace.unit.name}.`);
        }
        await this.p.$transaction(questions.map((question, index) => this.p.auditQuestion.upsert({
            where: {
                workspaceId_masterQuestionId: {
                    workspaceId,
                    masterQuestionId: question.id,
                },
            },
            create: {
                workspaceId,
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
            },
            update: {},
        })));
        await this.p.auditWorkspace.update({
            where: { id: workspaceId },
            data: {
                status: "INSTRUMENT_REVIEW",
                instrumentStatus: "AUDITOR_REVIEW",
                instrumentChangeCount: 0,
            },
        });
        await this.log(user.id, user.username, "INSTRUMENT_GENERATED", "AuditWorkspace", workspaceId, workspaceId, { count: questions.length, unitCode: workspace.unit.code });
        return { count: questions.length, unitCode: workspace.unit.code };
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppService);
//# sourceMappingURL=app.service.js.map