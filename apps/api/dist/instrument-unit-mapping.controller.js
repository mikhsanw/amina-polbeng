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
exports.InstrumentUnitMappingController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const prisma_service_1 = require("./prisma.service");
function uniqueStrings(value) {
    if (!Array.isArray(value))
        return [];
    return [
        ...new Set(value
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0)),
    ];
}
let InstrumentUnitMappingController = class InstrumentUnitMappingController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async replaceUnitMapping(unitId, body) {
        const unit = await this.prisma.unit.findUniqueOrThrow({
            where: { id: unitId },
        });
        if (!unit.active) {
            throw new common_1.BadRequestException("Unit nonaktif tidak dapat dipetakan.");
        }
        const questionIds = uniqueStrings(body.questionIds);
        if (questionIds.length) {
            const activeCount = await this.prisma.masterQuestion.count({
                where: { id: { in: questionIds }, active: true },
            });
            if (activeCount !== questionIds.length) {
                throw new common_1.BadRequestException("Sebagian instrumen tidak aktif atau tidak ditemukan.");
            }
        }
        const syncedPlanIds = [];
        await this.prisma.$transaction(async (transaction) => {
            await transaction.questionUnitMap.deleteMany({ where: { unitId } });
            if (questionIds.length) {
                await transaction.questionUnitMap.createMany({
                    data: questionIds.map((questionId) => ({ unitId, questionId })),
                    skipDuplicates: true,
                });
            }
            const candidatePlans = await transaction.auditUnitPlan.findMany({
                where: {
                    unitId,
                    workspaceId: null,
                    status: { in: ["DRAFT", "READY"] },
                },
                select: { id: true },
            });
            const candidatePlanIds = candidatePlans.map((plan) => plan.id);
            const existingLinks = candidatePlanIds.length
                ? await transaction.auditUnitPlanQuestion.findMany({
                    where: { planId: { in: candidatePlanIds } },
                    select: { planId: true },
                })
                : [];
            const occupiedPlanIds = new Set(existingLinks.map((link) => link.planId));
            const emptyPlans = candidatePlans.filter((plan) => !occupiedPlanIds.has(plan.id));
            for (const plan of emptyPlans) {
                if (questionIds.length) {
                    await transaction.auditUnitPlanQuestion.createMany({
                        data: questionIds.map((questionId) => ({
                            planId: plan.id,
                            questionId,
                        })),
                        skipDuplicates: true,
                    });
                }
                syncedPlanIds.push(plan.id);
            }
        });
        return {
            unitId,
            unitCode: unit.code,
            mappedQuestionCount: questionIds.length,
            synchronizedEmptyPlans: syncedPlanIds.length,
        };
    }
};
exports.InstrumentUnitMappingController = InstrumentUnitMappingController;
__decorate([
    (0, common_1.Put)("units/:unitId"),
    __param(0, (0, common_1.Param)("unitId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InstrumentUnitMappingController.prototype, "replaceUnitMapping", null);
exports.InstrumentUnitMappingController = InstrumentUnitMappingController = __decorate([
    (0, common_1.Controller)("instrument-unit-mapping"),
    (0, auth_1.Roles)("SUPER_ADMIN", "ADMIN_MUTU", "P4MP"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InstrumentUnitMappingController);
//# sourceMappingURL=instrument-unit-mapping.controller.js.map