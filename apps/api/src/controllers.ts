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
  Req,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import argon2 from "argon2";
import ExcelJS from "exceljs";
import { AppService } from "./app.service";
import { CurrentUser, Public, Roles } from "./auth";
import { PrismaService } from "./prisma.service";

@ApiTags("system")
@Controller()
export class HealthController {
  @Public()
  @Get("health")
  health() {
    return {
      status: "ok",
      service: "sami-nonak-api",
      alignment: "AMI_NONAK_2026",
      time: new Date().toISOString(),
    };
  }
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly service: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post("login")
  async login(
    @Body() body: any,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.login(
      body.username,
      body.password,
      request.ip,
      request.headers["user-agent"],
    );
    response.cookie("sami_session", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: result.hours * 3_600_000,
      path: "/",
    });
    return result.user;
  }

  @Get("me")
  me(@CurrentUser() user: any) {
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

  @Post("logout")
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.prisma.session.update({
      where: { id: user.sessionId },
      data: { revokedAt: new Date() },
    });
    response.clearCookie("sami_session");
    return { ok: true };
  }

  @Post("change-password")
  async changePassword(@CurrentUser() user: any, @Body() body: any) {
    if (!body.password || String(body.password).length < 8) {
      throw new BadRequestException("Password minimal 8 karakter.");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(body.password),
        mustChangePassword: false,
      },
    });
    return { ok: true };
  }
}

@ApiTags("users")
@Controller("users")
@Roles("SUPER_ADMIN", "ADMIN_MUTU")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query("q") query = "") {
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

  @Post()
  async create(@Body() body: any) {
    if (!body.username || !body.fullName || !body.password) {
      throw new BadRequestException(
        "Username, nama lengkap, dan password wajib diisi.",
      );
    }
    if (!(body.roles || []).length) {
      throw new BadRequestException("Minimal satu role wajib dipilih.");
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
      throw new BadRequestException("Username atau email sudah digunakan.");
    }
    return this.prisma.user.create({
      data: {
        username: body.username,
        fullName: body.fullName,
        email: body.email || null,
        passwordHash: await argon2.hash(body.password),
        unitId: body.unitId || null,
        isUnitApprover: Boolean(body.isUnitApprover),
        roles: {
          create: (body.roles || []).map((roleId: string) => ({ roleId })),
        },
      },
      select: { id: true, username: true },
    });
  }

  @Get(":id")
  one(@Param("id") id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { unit: true, roles: { include: { role: true } } },
    });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: body.fullName,
        email: body.email || null,
        unitId: body.unitId || null,
        isUnitApprover:
          body.isUnitApprover == null ? undefined : Boolean(body.isUnitApprover),
        ...(body.roles
          ? {
              roles: {
                deleteMany: {},
                create: body.roles.map((roleId: string) => ({ roleId })),
              },
            }
          : {}),
      },
    });
  }

  @Patch(":id/status")
  status(@Param("id") id: string, @Body() body: any) {
    return this.prisma.user.update({
      where: { id },
      data: { status: body.status },
    });
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const assignments = await this.prisma.auditTeam.count({ where: { userId: id } });
    if (assignments) {
      throw new BadRequestException(
        "Pengguna mempunyai riwayat penugasan dan hanya dapat dinonaktifkan.",
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
  }
}

@ApiTags("master")
@Controller("master")
export class MasterController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("roles")
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

  @Get("permissions")
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
  }

  @Get("units")
  units() {
    return this.prisma.unit.findMany({
      include: { functions: true },
      orderBy: { name: "asc" },
    });
  }

  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  @Post("units")
  unit(@Body() body: any) {
    return this.prisma.unit.create({ data: body });
  }

  @Get("standards")
  standards() {
    return this.prisma.standard.findMany({ orderBy: { code: "asc" } });
  }

  @Get("iso-clauses")
  isoClauses() {
    return this.prisma.isoClause.findMany({ orderBy: { code: "asc" } });
  }

  @Get("questions")
  async questions(
    @Query("module") module?: string,
    @Query("dimension") dimension?: string,
    @Query("q") query = "",
    @Query("page") pageValue = "1",
    @Query("limit") limitValue = "50",
  ) {
    const page = Math.max(1, Number(pageValue));
    const take = Math.min(100, Math.max(10, Number(limitValue)));
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

  @Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
  @Post("questions")
  createQuestion(@Body() body: any) {
    return this.prisma.masterQuestion.create({
      data: {
        ...body,
        weight: Number(body.weight),
        unitMaps: body.unitIds?.length
          ? { create: body.unitIds.map((unitId: string) => ({ unitId })) }
          : undefined,
      },
    });
  }

  @Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
  @Patch("questions/:id")
  updateQuestion(@Param("id") id: string, @Body() body: any) {
    return this.prisma.masterQuestion.update({
      where: { id },
      data: {
        ...body,
        weight: body.weight == null ? undefined : Number(body.weight),
        version: { increment: 1 },
      },
    });
  }

  @Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
  @Delete("questions/:id")
  deactivateQuestion(@Param("id") id: string) {
    return this.prisma.masterQuestion.update({
      where: { id },
      data: { active: false },
    });
  }

  @Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP")
  @Get("questions/template")
  async questionTemplate(@Res() response: Response) {
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
    const workbook = new ExcelJS.Workbook();
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
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="Template_Master_Pertanyaan_SAMI_NONAK_v2026-D1.xlsx"',
    );
    response.send(Buffer.from(buffer));
  }
}

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async data(@CurrentUser() user: any) {
    const global = user.roleCodes.some((role: string) =>
      ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"].includes(role),
    );
    const workspaceWhere: any = global
      ? {}
      : {
          OR: [
            { unitId: user.unitId ?? "_" },
            { team: { some: { userId: user.id } } },
          ],
        };
    const [units, workspaces, findings, overdueActions, unreadNotifications] =
      await Promise.all([
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

    const tasks: { type: string; label: string; count: number; href: string }[] = [];
    if (user.roleCodes.some((role: string) => ["AUDITOR", "KETUA_AUDITOR"].includes(role))) {
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
}
