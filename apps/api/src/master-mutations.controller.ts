import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Roles } from "./auth";
import { PrismaService } from "./prisma.service";

@Controller("master-admin")
@Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
export class MasterMutationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("questions")
  questions(
    @Query("module") module?: string,
    @Query("dimension") dimension?: string,
    @Query("q") query = "",
  ) {
    const where: any = {
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

  @Patch("units/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async updateUnit(@Param("id") id: string, @Body() body: any) {
    const before = await this.prisma.unit.findUniqueOrThrow({ where: { id } });
    const code =
      body.code == null ? before.code : String(body.code).trim().toUpperCase();
    const name = body.name == null ? before.name : String(body.name).trim();
    const slug =
      body.slug == null
        ? before.slug
        : String(body.slug)
            .trim()
            .replace(/[^a-zA-Z0-9_]+/g, "_");
    const duplicate = await this.prisma.unit.findFirst({
      where: { id: { not: id }, OR: [{ code }, { slug }] },
    });
    if (duplicate) {
      throw new BadRequestException("Kode atau slug unit sudah digunakan.");
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

  @Delete("units/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  deactivateUnit(@Param("id") id: string) {
    return this.prisma.unit.update({
      where: { id },
      data: { active: false },
      include: { functions: true },
    });
  }

  @Post("units/:id/functions")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async createUnitFunction(@Param("id") unitId: string, @Body() body: any) {
    const code = String(body.code || "")
      .trim()
      .toUpperCase();
    const description = String(body.description || "").trim();
    if (!code || !description) {
      throw new BadRequestException("Kode dan pernyataan tupoksi wajib diisi.");
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

  @Patch("unit-functions/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  updateUnitFunction(@Param("id") id: string, @Body() body: any) {
    return this.prisma.unitFunction.update({
      where: { id },
      data: {
        code: body.code ? String(body.code).trim().toUpperCase() : undefined,
        description:
          body.description == null
            ? undefined
            : String(body.description).trim(),
        sourceRef: body.sourceRef === "" ? null : body.sourceRef,
        riskLevel: body.riskLevel === "" ? null : body.riskLevel,
        active: body.active == null ? undefined : Boolean(body.active),
      },
    });
  }

  @Delete("unit-functions/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  deactivateUnitFunction(@Param("id") id: string) {
    return this.prisma.unitFunction.update({
      where: { id },
      data: { active: false },
    });
  }

  @Post("standards")
  createStandard(@Body() body: any) {
    if (!body.code || !body.title || !body.source) {
      throw new BadRequestException(
        "Kode, judul, dan sumber standar wajib diisi.",
      );
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

  @Patch("standards/:id")
  updateStandard(@Param("id") id: string, @Body() body: any) {
    return this.prisma.standard.update({
      where: { id },
      data: {
        code: body.code ? String(body.code).trim().toUpperCase() : undefined,
        title: body.title == null ? undefined : String(body.title).trim(),
        source: body.source == null ? undefined : String(body.source).trim(),
        standardType: body.standardType
          ? String(body.standardType).trim().toUpperCase()
          : undefined,
        regulationReference:
          body.regulationReference === "" ? null : body.regulationReference,
        description: body.description === "" ? null : body.description,
        active: body.active == null ? undefined : Boolean(body.active),
      },
    });
  }

  @Delete("standards/:id")
  deactivateStandard(@Param("id") id: string) {
    return this.prisma.standard.update({
      where: { id },
      data: { active: false },
    });
  }

  @Post("iso-clauses")
  createIsoClause(@Body() body: any) {
    if (!body.code || !body.title) {
      throw new BadRequestException("Nomor dan judul klausul ISO wajib diisi.");
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

  @Patch("iso-clauses/:id")
  updateIsoClause(@Param("id") id: string, @Body() body: any) {
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

  @Delete("iso-clauses/:id")
  deactivateIsoClause(@Param("id") id: string) {
    return this.prisma.isoClause.update({
      where: { id },
      data: { active: false },
    });
  }

  @Post("questions")
  createQuestion(@Body() body: any) {
    const unitIds = Array.isArray(body.unitIds) ? body.unitIds : [];
    const functionIds = Array.isArray(body.functionIds) ? body.functionIds : [];
    if (!body.code || !body.moduleCode || !body.question) {
      throw new BadRequestException("Kode, modul, dan pertanyaan wajib diisi.");
    }
    const weight = Number(body.weight || 1);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException("Bobot harus lebih dari 0.");
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
          ? { create: unitIds.map((unitId: string) => ({ unitId })) }
          : undefined,
        functionMaps: functionIds.length
          ? {
              create: functionIds.map((functionId: string) => ({ functionId })),
            }
          : undefined,
      },
    });
  }

  @Patch("questions/:id")
  updateQuestion(@Param("id") id: string, @Body() body: any) {
    const unitIds = Array.isArray(body.unitIds) ? body.unitIds : null;
    const functionIds = Array.isArray(body.functionIds)
      ? body.functionIds
      : null;
    const weight = body.weight == null ? undefined : Number(body.weight);
    if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
      throw new BadRequestException("Bobot harus lebih dari 0.");
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
        question:
          body.question == null ? undefined : String(body.question).trim(),
        auditObjective: body.auditObjective === "" ? null : body.auditObjective,
        expectedEvidence:
          body.expectedEvidence === "" ? null : body.expectedEvidence,
        testMethod: body.testMethod === "" ? null : body.testMethod,
        regulatoryReference:
          body.regulatoryReference === "" ? null : body.regulatoryReference,
        regulatorySummary:
          body.regulatorySummary === "" ? null : body.regulatorySummary,
        internalRequirement:
          body.internalRequirement === "" ? null : body.internalRequirement,
        businessProcess:
          body.businessProcess === "" ? null : body.businessProcess,
        riskLevel: body.riskLevel,
        weight,
        required: body.required,
        active: body.active,
        standardId: body.standardId === "" ? null : body.standardId,
        isoClauseId: body.isoClauseId === "" ? null : body.isoClauseId,
        unitMaps: unitIds
          ? {
              deleteMany: {},
              create: unitIds.map((unitId: string) => ({ unitId })),
            }
          : undefined,
        functionMaps: functionIds
          ? {
              deleteMany: {},
              create: functionIds.map((functionId: string) => ({ functionId })),
            }
          : undefined,
        version: { increment: 1 },
      },
    });
  }

  @Delete("questions/:id")
  deactivateQuestion(@Param("id") id: string) {
    return this.prisma.masterQuestion.update({
      where: { id },
      data: { active: false },
    });
  }
}
