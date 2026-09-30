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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = exports.MasterController = exports.UsersController = exports.AuthController = exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const argon2_1 = __importDefault(require("argon2"));
const exceljs_1 = __importDefault(require("exceljs"));
const app_service_1 = require("./app.service");
const auth_1 = require("./auth");
const prisma_service_1 = require("./prisma.service");
let HealthController = class HealthController {
    health() {
        return {
            status: "ok",
            service: "sami-nonak-api",
            alignment: "AMI_NONAK_2026",
            time: new Date().toISOString(),
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, auth_1.Public)(),
    (0, common_1.Get)("health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "health", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)("system"),
    (0, common_1.Controller)()
], HealthController);
let AuthController = class AuthController {
    service;
    prisma;
    constructor(service, prisma) {
        this.service = service;
        this.prisma = prisma;
    }
    async login(body, request, response) {
        const result = await this.service.login(body.username, body.password, request.ip, request.headers["user-agent"]);
        response.cookie("sami_session", result.token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: result.hours * 3_600_000,
            path: "/",
        });
        return result.user;
    }
    me(user) {
        return {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            mustChangePassword: user.mustChangePassword,
            roles: user.roleCodes,
            permissions: user.permissionCodes,
            unitId: user.unitId,
            isUnitApprover: user.isUnitApprover,
        };
    }
    async logout(user, response) {
        await this.prisma.session.update({
            where: { id: user.sessionId },
            data: { revokedAt: new Date() },
        });
        response.clearCookie("sami_session");
        return { ok: true };
    }
    async changePassword(user, body) {
        if (!body.password || String(body.password).length < 8) {
            throw new common_1.BadRequestException("Password minimal 8 karakter.");
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: await argon2_1.default.hash(body.password),
                mustChangePassword: false,
            },
        });
        return { ok: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, auth_1.Public)(),
    (0, common_1.Post)("login"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)("me"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)("logout"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)("change-password"),
    __param(0, (0, auth_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Controller)("auth"),
    __metadata("design:paramtypes", [app_service_1.AppService,
        prisma_service_1.PrismaService])
], AuthController);
let UsersController = class UsersController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(query = "") {
        return this.prisma.user.findMany({
            where: {
                deletedAt: null,
                ...(query
                    ? {
                        OR: [
                            { username: { contains: query } },
                            { fullName: { contains: query } },
                        ],
                    }
                    : {}),
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                status: true,
                mustChangePassword: true,
                isUnitApprover: true,
                unit: true,
                roles: { include: { role: true } },
            },
            orderBy: { fullName: "asc" },
        });
    }
    async create(body) {
        if (!body.username || !body.fullName || !body.password) {
            throw new common_1.BadRequestException("Username, nama lengkap, dan password wajib diisi.");
        }
        if (!(body.roles || []).length) {
            throw new common_1.BadRequestException("Minimal satu role wajib dipilih.");
        }
        const duplicate = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { username: body.username },
                    ...(body.email ? [{ email: body.email }] : []),
                ],
            },
        });
        if (duplicate) {
            throw new common_1.BadRequestException("Username atau email sudah digunakan.");
        }
        return this.prisma.user.create({
            data: {
                username: body.username,
                fullName: body.fullName,
                email: body.email || null,
                passwordHash: await argon2_1.default.hash(body.password),
                unitId: body.unitId || null,
                isUnitApprover: Boolean(body.isUnitApprover),
                roles: {
                    create: (body.roles || []).map((roleId) => ({ roleId })),
                },
            },
            select: { id: true, username: true },
        });
    }
    one(id) {
        return this.prisma.user.findUniqueOrThrow({
            where: { id },
            include: { unit: true, roles: { include: { role: true } } },
        });
    }
    update(id, body) {
        return this.prisma.user.update({
            where: { id },
            data: {
                fullName: body.fullName,
                email: body.email || null,
                unitId: body.unitId || null,
                isUnitApprover: body.isUnitApprover == null ? undefined : Boolean(body.isUnitApprover),
                ...(body.roles
                    ? {
                        roles: {
                            deleteMany: {},
                            create: body.roles.map((roleId) => ({ roleId })),
                        },
                    }
                    : {}),
            },
        });
    }
    status(id, body) {
        return this.prisma.user.update({
            where: { id },
            data: { status: body.status },
        });
    }
    async remove(id) {
        const assignments = await this.prisma.auditTeam.count({ where: { userId: id } });
        if (assignments) {
            throw new common_1.BadRequestException("Pengguna mempunyai riwayat penugasan dan hanya dapat dinonaktifkan.");
        }
        return this.prisma.user.update({
            where: { id },
            data: { status: "INACTIVE", deletedAt: new Date() },
        });
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("q")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "one", null);
__decorate([
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(":id/status"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "status", null);
__decorate([
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)("users"),
    (0, common_1.Controller)("users"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersController);
let MasterController = class MasterController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    roles() {
        return this.prisma.role.findMany({
            where: {
                code: {
                    in: [
                        "SUPER_ADMIN",
                        "ADMIN_MUTU",
                        "P4MP",
                        "AUDITOR",
                        "KETUA_AUDITOR",
                        "AUDITEE",
                        "VERIFIKATOR",
                        "PIMPINAN",
                    ],
                },
            },
            include: { permissions: { include: { permission: true } } },
            orderBy: { code: "asc" },
        });
    }
    permissions() {
        return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
    }
    units() {
        return this.prisma.unit.findMany({
            include: { functions: true },
            orderBy: { name: "asc" },
        });
    }
    unit(body) {
        return this.prisma.unit.create({ data: body });
    }
    standards() {
        return this.prisma.standard.findMany({ orderBy: { code: "asc" } });
    }
    isoClauses() {
        return this.prisma.isoClause.findMany({ orderBy: { code: "asc" } });
    }
    async questions(module, dimension, query = "", pageValue = "1", limitValue = "50") {
        const page = Math.max(1, Number(pageValue));
        const take = Math.min(100, Math.max(10, Number(limitValue)));
        const where = {
            ...(module ? { moduleCode: module } : {}),
            ...(dimension ? { dimension } : {}),
            ...(query
                ? {
                    OR: [
                        { code: { contains: query } },
                        { question: { contains: query } },
                    ],
                }
                : {}),
        };
        const [data, total] = await Promise.all([
            this.prisma.masterQuestion.findMany({
                where,
                include: {
                    standard: true,
                    isoClause: true,
                    unitMaps: { include: { unit: true } },
                    functionMaps: { include: { function: true } },
                },
                orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
                skip: (page - 1) * take,
                take,
            }),
            this.prisma.masterQuestion.count({ where }),
        ]);
        return { data, total, page, limit: take };
    }
    createQuestion(body) {
        return this.prisma.masterQuestion.create({
            data: {
                ...body,
                weight: Number(body.weight),
                unitMaps: body.unitIds?.length
                    ? { create: body.unitIds.map((unitId) => ({ unitId })) }
                    : undefined,
            },
        });
    }
    updateQuestion(id, body) {
        return this.prisma.masterQuestion.update({
            where: { id },
            data: {
                ...body,
                weight: body.weight == null ? undefined : Number(body.weight),
                version: { increment: 1 },
            },
        });
    }
    deactivateQuestion(id) {
        return this.prisma.masterQuestion.update({
            where: { id },
            data: { active: false },
        });
    }
    async questionTemplate(response) {
        const [questions, units] = await Promise.all([
            this.prisma.masterQuestion.findMany({
                where: { active: true },
                include: {
                    standard: true,
                    isoClause: true,
                    unitMaps: { include: { unit: true } },
                },
                orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
            }),
            this.prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
        ]);
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = "SAMI-NONAK POLBENG";
        const guide = workbook.addWorksheet("00_PETUNJUK");
        guide.columns = [{ width: 28 }, { width: 90 }];
        guide.addRows([
            ["TEMPLATE", "Bank Instrumen Default SAMI-NONAK POLBENG"],
            ["DIMENSI", "STANDARD_ACHIEVEMENT untuk capaian standar; PROCESS_CONFORMITY untuk proses bisnis ISO 9001:2015."],
            ["HASIL STANDAR", "MELAMPAUI, TERCAPAI, TIDAK_TERCAPAI, BELUM_DIUKUR."],
            ["HASIL PROSES", "C, OFI, OBS, KTS_MINOR, KTS_MAYOR, GP, NA."],
            ["UNIT", "Pisahkan beberapa kode unit menggunakan tanda |."],
        ]);
        guide.getRow(1).font = { bold: true };
        const sheet = workbook.addWorksheet("01_PERTANYAAN", {
            views: [{ state: "frozen", ySplit: 1 }],
        });
        const headers = [
            "question_code",
            "module_code",
            "dimension",
            "criterion_source",
            "question_text",
            "audit_objective",
            "expected_evidence",
            "test_method",
            "regulatory_reference",
            "internal_requirement",
            "business_process",
            "iso_clause",
            "risk_level",
            "weight",
            "mandatory",
            "active",
            "unit_codes",
        ];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F4C6E" },
        };
        for (const question of questions) {
            sheet.addRow([
                question.code,
                question.moduleCode,
                question.dimension,
                question.criterionSource,
                question.question,
                question.auditObjective || "",
                question.expectedEvidence || "",
                question.testMethod || "",
                question.regulatoryReference || "",
                question.internalRequirement || "",
                question.businessProcess || "",
                question.isoClause?.code || "",
                question.riskLevel,
                Number(question.weight),
                question.required ? "YA" : "TIDAK",
                question.active ? "YA" : "TIDAK",
                question.unitMaps.map((item) => item.unit.code).join("|"),
            ]);
        }
        sheet.autoFilter = { from: "A1", to: "Q1" };
        sheet.columns.forEach((column, index) => {
            column.width = [18, 18, 24, 28, 65, 42, 42, 30, 28, 38, 28, 15, 14, 10, 12, 10, 40][index];
            column.alignment = { vertical: "top", wrapText: true };
        });
        const lookup = workbook.addWorksheet("02_LOOKUP");
        lookup.addRow(["DIMENSION", "RISK_LEVEL", "BOOLEAN", "UNIT_CODE"]);
        const dimensions = ["STANDARD_ACHIEVEMENT", "PROCESS_CONFORMITY"];
        const risks = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
        const booleans = ["YA", "TIDAK"];
        const count = Math.max(dimensions.length, risks.length, booleans.length, units.length);
        for (let index = 0; index < count; index += 1) {
            lookup.addRow([
                dimensions[index] || "",
                risks[index] || "",
                booleans[index] || "",
                units[index]?.code || "",
            ]);
        }
        const metadata = workbook.addWorksheet("03_METADATA");
        metadata.state = "veryHidden";
        metadata.addRows([
            ["template_type", "MASTER_QUESTION"],
            ["template_version", "2026-D1"],
            ["exported_at", new Date().toISOString()],
            ["total_questions", questions.length],
        ]);
        workbook.addWorksheet("04_VALIDATION_RESULT").addRow([
            "row_number",
            "question_code",
            "field_name",
            "severity",
            "error_code",
            "message",
            "suggested_fix",
        ]);
        const buffer = await workbook.xlsx.writeBuffer();
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", 'attachment; filename="Template_Master_Pertanyaan_SAMI_NONAK_v2026-D1.xlsx"');
        response.send(Buffer.from(buffer));
    }
};
exports.MasterController = MasterController;
__decorate([
    (0, common_1.Get)("roles"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "roles", null);
__decorate([
    (0, common_1.Get)("permissions"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "permissions", null);
__decorate([
    (0, common_1.Get)("units"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "units", null);
__decorate([
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    (0, common_1.Post)("units"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "unit", null);
__decorate([
    (0, common_1.Get)("standards"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "standards", null);
__decorate([
    (0, common_1.Get)("iso-clauses"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "isoClauses", null);
__decorate([
    (0, common_1.Get)("questions"),
    __param(0, (0, common_1.Query)("module")),
    __param(1, (0, common_1.Query)("dimension")),
    __param(2, (0, common_1.Query)("q")),
    __param(3, (0, common_1.Query)("page")),
    __param(4, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "questions", null);
__decorate([
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    (0, common_1.Post)("questions"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "createQuestion", null);
__decorate([
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    (0, common_1.Patch)("questions/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "updateQuestion", null);
__decorate([
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    (0, common_1.Delete)("questions/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterController.prototype, "deactivateQuestion", null);
__decorate([
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    (0, common_1.Get)("questions/template"),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterController.prototype, "questionTemplate", null);
exports.MasterController = MasterController = __decorate([
    (0, swagger_1.ApiTags)("master"),
    (0, common_1.Controller)("master"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MasterController);
let DashboardController = class DashboardController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async data(user) {
        const global = user.roleCodes.some((role) => ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"].includes(role));
        const workspaceWhere = global
            ? {}
            : {
                OR: [
                    { unitId: user.unitId ?? "_" },
                    { team: { some: { userId: user.id } } },
                ],
            };
        const [units, workspaces, findings, overdueActions, unreadNotifications] = await Promise.all([
            this.prisma.unit.count({ where: { active: true } }),
            this.prisma.auditWorkspace.count({ where: workspaceWhere }),
            this.prisma.finding.count({
                where: {
                    workspace: { is: workspaceWhere },
                    status: { notIn: ["CLOSED", "VOID"] },
                },
            }),
            this.prisma.correctiveAction.count({
                where: {
                    workspace: { is: workspaceWhere },
                    targetDate: { lt: new Date() },
                    status: { notIn: ["EFFECTIVE"] },
                },
            }),
            this.prisma.notification.count({
                where: { recipientUserId: user.id, readAt: null },
            }),
        ]);
        const tasks = [];
        if (user.roleCodes.some((role) => ["AUDITOR", "KETUA_AUDITOR"].includes(role))) {
            tasks.push({
                type: "INSTRUMENT_REVIEW",
                label: "Instrumen perlu ditelaah",
                count: await this.prisma.auditWorkspace.count({
                    where: {
                        ...workspaceWhere,
                        instrumentStatus: { in: ["AUDITOR_REVIEW", "RETURNED"] },
                    },
                }),
                href: "/audit-workspaces?task=instrument",
            });
            tasks.push({
                type: "WORKPAPER",
                label: "Kertas kerja belum disetujui",
                count: await this.prisma.workpaper.count({
                    where: {
                        question: { workspace: { is: workspaceWhere } },
                        documentStatus: { in: ["DRAFT", "RETURNED", "SUBMITTED"] },
                    },
                }),
                href: "/audit-workspaces?task=workpaper",
            });
        }
        if (user.roleCodes.includes("VERIFIKATOR")) {
            tasks.push({
                type: "INSTRUMENT_APPROVAL",
                label: "Perubahan instrumen menunggu verifikasi",
                count: await this.prisma.auditWorkspace.count({
                    where: {
                        team: { some: { userId: user.id, role: "VERIFIER" } },
                        instrumentStatus: "PENDING_VERIFICATION",
                    },
                }),
                href: "/audit-workspaces?task=verification",
            });
        }
        if (user.roleCodes.includes("AUDITEE")) {
            tasks.push({
                type: "SELF_ASSESSMENT",
                label: "Penilaian mandiri belum selesai",
                count: await this.prisma.selfAssessment.count({
                    where: {
                        question: { workspace: { unitId: user.unitId ?? "_" } },
                        responseStatus: { in: ["NOT_STARTED", "IN_PROGRESS", "RETURNED"] },
                    },
                }),
                href: "/audit-workspaces?task=assessment",
            });
        }
        return {
            units,
            workspaces,
            openFindings: findings,
            overdueActions,
            unreadNotifications,
            roles: user.roleCodes,
            tasks,
        };
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "data", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)("dashboard"),
    (0, common_1.Controller)("dashboard"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardController);
//# sourceMappingURL=controllers.js.map