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
exports.MasterMutationsController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const prisma_service_1 = require("./prisma.service");
let MasterMutationsController = class MasterMutationsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    questions(module, dimension, query = "") {
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
        return this.prisma.masterQuestion.findMany({
            where,
            include: {
                standard: true,
                isoClause: true,
                unitMaps: { include: { unit: true } },
                functionMaps: { include: { function: true } },
            },
            orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
        });
    }
    async updateUnit(id, body) {
        const before = await this.prisma.unit.findUniqueOrThrow({ where: { id } });
        const code = body.code == null ? before.code : String(body.code).trim().toUpperCase();
        const name = body.name == null ? before.name : String(body.name).trim();
        const slug = body.slug == null
            ? before.slug
            : String(body.slug)
                .trim()
                .replace(/[^a-zA-Z0-9_]+/g, "_");
        const duplicate = await this.prisma.unit.findFirst({
            where: { id: { not: id }, OR: [{ code }, { slug }] },
        });
        if (duplicate) {
            throw new common_1.BadRequestException("Kode atau slug unit sudah digunakan.");
        }
        return this.prisma.unit.update({
            where: { id },
            data: {
                code,
                name,
                slug,
                active: body.active == null ? undefined : Boolean(body.active),
            },
            include: { functions: true },
        });
    }
    deactivateUnit(id) {
        return this.prisma.unit.update({
            where: { id },
            data: { active: false },
            include: { functions: true },
        });
    }
    async createUnitFunction(unitId, body) {
        const code = String(body.code || "")
            .trim()
            .toUpperCase();
        const description = String(body.description || "").trim();
        if (!code || !description) {
            throw new common_1.BadRequestException("Kode dan pernyataan tupoksi wajib diisi.");
        }
        await this.prisma.unit.findUniqueOrThrow({ where: { id: unitId } });
        return this.prisma.unitFunction.upsert({
            where: { unitId_code: { unitId, code } },
            create: {
                unitId,
                code,
                description,
                sourceRef: body.sourceRef || null,
                riskLevel: body.riskLevel || null,
                active: body.active !== false,
            },
            update: {
                description,
                sourceRef: body.sourceRef || null,
                riskLevel: body.riskLevel || null,
                active: body.active !== false,
            },
        });
    }
    updateUnitFunction(id, body) {
        return this.prisma.unitFunction.update({
            where: { id },
            data: {
                code: body.code ? String(body.code).trim().toUpperCase() : undefined,
                description: body.description == null
                    ? undefined
                    : String(body.description).trim(),
                sourceRef: body.sourceRef === "" ? null : body.sourceRef,
                riskLevel: body.riskLevel === "" ? null : body.riskLevel,
                active: body.active == null ? undefined : Boolean(body.active),
            },
        });
    }
    deactivateUnitFunction(id) {
        return this.prisma.unitFunction.update({
            where: { id },
            data: { active: false },
        });
    }
    createStandard(body) {
        if (!body.code || !body.title || !body.source) {
            throw new common_1.BadRequestException("Kode, judul, dan sumber standar wajib diisi.");
        }
        return this.prisma.standard.create({
            data: {
                code: String(body.code).trim().toUpperCase(),
                title: String(body.title).trim(),
                source: String(body.source).trim(),
                standardType: String(body.standardType || "INTERNAL")
                    .trim()
                    .toUpperCase(),
                regulationReference: body.regulationReference || null,
                description: body.description || null,
                active: body.active !== false,
            },
        });
    }
    updateStandard(id, body) {
        return this.prisma.standard.update({
            where: { id },
            data: {
                code: body.code ? String(body.code).trim().toUpperCase() : undefined,
                title: body.title == null ? undefined : String(body.title).trim(),
                source: body.source == null ? undefined : String(body.source).trim(),
                standardType: body.standardType
                    ? String(body.standardType).trim().toUpperCase()
                    : undefined,
                regulationReference: body.regulationReference === "" ? null : body.regulationReference,
                description: body.description === "" ? null : body.description,
                active: body.active == null ? undefined : Boolean(body.active),
            },
        });
    }
    deactivateStandard(id) {
        return this.prisma.standard.update({
            where: { id },
            data: { active: false },
        });
    }
    createIsoClause(body) {
        if (!body.code || !body.title) {
            throw new common_1.BadRequestException("Nomor dan judul klausul ISO wajib diisi.");
        }
        return this.prisma.isoClause.create({
            data: {
                code: String(body.code).trim(),
                title: String(body.title).trim(),
                description: body.description || null,
                active: body.active !== false,
            },
        });
    }
    updateIsoClause(id, body) {
        return this.prisma.isoClause.update({
            where: { id },
            data: {
                code: body.code == null ? undefined : String(body.code).trim(),
                title: body.title == null ? undefined : String(body.title).trim(),
                description: body.description === "" ? null : body.description,
                active: body.active == null ? undefined : Boolean(body.active),
            },
        });
    }
    deactivateIsoClause(id) {
        return this.prisma.isoClause.update({
            where: { id },
            data: { active: false },
        });
    }
    createQuestion(body) {
        const unitIds = Array.isArray(body.unitIds) ? body.unitIds : [];
        const functionIds = Array.isArray(body.functionIds) ? body.functionIds : [];
        if (!body.code || !body.moduleCode || !body.question) {
            throw new common_1.BadRequestException("Kode, modul, dan pertanyaan wajib diisi.");
        }
        const weight = Number(body.weight || 1);
        if (!Number.isFinite(weight) || weight <= 0) {
            throw new common_1.BadRequestException("Bobot harus lebih dari 0.");
        }
        return this.prisma.masterQuestion.create({
            data: {
                code: String(body.code).trim().toUpperCase(),
                moduleCode: String(body.moduleCode).trim().toUpperCase(),
                dimension: body.dimension || "PROCESS_CONFORMITY",
                criterionSource: body.criterionSource || "ISO_9001",
                question: String(body.question).trim(),
                auditObjective: body.auditObjective || null,
                expectedEvidence: body.expectedEvidence || null,
                testMethod: body.testMethod || null,
                regulatoryReference: body.regulatoryReference || null,
                regulatorySummary: body.regulatorySummary || null,
                internalRequirement: body.internalRequirement || null,
                businessProcess: body.businessProcess || null,
                riskLevel: body.riskLevel || "MEDIUM",
                weight,
                required: body.required !== false,
                active: body.active !== false,
                standardId: body.standardId || null,
                isoClauseId: body.isoClauseId || null,
                unitMaps: unitIds.length
                    ? { create: unitIds.map((unitId) => ({ unitId })) }
                    : undefined,
                functionMaps: functionIds.length
                    ? {
                        create: functionIds.map((functionId) => ({ functionId })),
                    }
                    : undefined,
            },
        });
    }
    updateQuestion(id, body) {
        const unitIds = Array.isArray(body.unitIds) ? body.unitIds : null;
        const functionIds = Array.isArray(body.functionIds)
            ? body.functionIds
            : null;
        const weight = body.weight == null ? undefined : Number(body.weight);
        if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
            throw new common_1.BadRequestException("Bobot harus lebih dari 0.");
        }
        return this.prisma.masterQuestion.update({
            where: { id },
            data: {
                code: body.code ? String(body.code).trim().toUpperCase() : undefined,
                moduleCode: body.moduleCode
                    ? String(body.moduleCode).trim().toUpperCase()
                    : undefined,
                dimension: body.dimension,
                criterionSource: body.criterionSource,
                question: body.question == null ? undefined : String(body.question).trim(),
                auditObjective: body.auditObjective === "" ? null : body.auditObjective,
                expectedEvidence: body.expectedEvidence === "" ? null : body.expectedEvidence,
                testMethod: body.testMethod === "" ? null : body.testMethod,
                regulatoryReference: body.regulatoryReference === "" ? null : body.regulatoryReference,
                regulatorySummary: body.regulatorySummary === "" ? null : body.regulatorySummary,
                internalRequirement: body.internalRequirement === "" ? null : body.internalRequirement,
                businessProcess: body.businessProcess === "" ? null : body.businessProcess,
                riskLevel: body.riskLevel,
                weight,
                required: body.required,
                active: body.active,
                standardId: body.standardId === "" ? null : body.standardId,
                isoClauseId: body.isoClauseId === "" ? null : body.isoClauseId,
                unitMaps: unitIds
                    ? {
                        deleteMany: {},
                        create: unitIds.map((unitId) => ({ unitId })),
                    }
                    : undefined,
                functionMaps: functionIds
                    ? {
                        deleteMany: {},
                        create: functionIds.map((functionId) => ({ functionId })),
                    }
                    : undefined,
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
};
exports.MasterMutationsController = MasterMutationsController;
__decorate([
    (0, common_1.Get)("questions"),
    __param(0, (0, common_1.Query)("module")),
    __param(1, (0, common_1.Query)("dimension")),
    __param(2, (0, common_1.Query)("q")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "questions", null);
__decorate([
    (0, common_1.Patch)("units/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MasterMutationsController.prototype, "updateUnit", null);
__decorate([
    (0, common_1.Delete)("units/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "deactivateUnit", null);
__decorate([
    (0, common_1.Post)("units/:id/functions"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MasterMutationsController.prototype, "createUnitFunction", null);
__decorate([
    (0, common_1.Patch)("unit-functions/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "updateUnitFunction", null);
__decorate([
    (0, common_1.Delete)("unit-functions/:id"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "deactivateUnitFunction", null);
__decorate([
    (0, common_1.Post)("standards"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "createStandard", null);
__decorate([
    (0, common_1.Patch)("standards/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "updateStandard", null);
__decorate([
    (0, common_1.Delete)("standards/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "deactivateStandard", null);
__decorate([
    (0, common_1.Post)("iso-clauses"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "createIsoClause", null);
__decorate([
    (0, common_1.Patch)("iso-clauses/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "updateIsoClause", null);
__decorate([
    (0, common_1.Delete)("iso-clauses/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "deactivateIsoClause", null);
__decorate([
    (0, common_1.Post)("questions"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "createQuestion", null);
__decorate([
    (0, common_1.Patch)("questions/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "updateQuestion", null);
__decorate([
    (0, common_1.Delete)("questions/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterMutationsController.prototype, "deactivateQuestion", null);
exports.MasterMutationsController = MasterMutationsController = __decorate([
    (0, common_1.Controller)("master-admin"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MasterMutationsController);
//# sourceMappingURL=master-mutations.controller.js.map