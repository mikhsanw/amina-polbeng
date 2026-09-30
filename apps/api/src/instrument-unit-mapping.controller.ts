import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Put,
} from "@nestjs/common";
import { Roles } from "./auth";
import { PrismaService } from "./prisma.service";

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item: unknown) => String(item).trim())
        .filter((item: string) => item.length > 0),
    ),
  ];
}

@Controller("instrument-unit-mapping")
@Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
export class InstrumentUnitMappingController {
  constructor(private readonly prisma: PrismaService) {}

  @Put("units/:unitId")
  async replaceUnitMapping(
    @Param("unitId") unitId: string,
    @Body() body: any,
  ) {
    const unit = await this.prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
    });
    if (!unit.active) {
      throw new BadRequestException("Unit nonaktif tidak dapat dipetakan.");
    }

    const questionIds = uniqueStrings(body.questionIds);
    if (questionIds.length) {
      const activeCount = await this.prisma.masterQuestion.count({
        where: { id: { in: questionIds }, active: true },
      });
      if (activeCount !== questionIds.length) {
        throw new BadRequestException(
          "Sebagian instrumen tidak aktif atau tidak ditemukan.",
        );
      }
    }

    const syncedPlanIds: string[] = [];
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
      const occupiedPlanIds = new Set(
        existingLinks.map((link) => link.planId),
      );
      const emptyPlans = candidatePlans.filter(
        (plan) => !occupiedPlanIds.has(plan.id),
      );

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
}
