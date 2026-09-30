import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { PrismaService } from "./prisma.service";

const ACTIVE_ROLE_CODES = [
  "SUPER_ADMIN",
  "ADMIN_MUTU",
  "P4MP",
  "AUDITOR",
  "KETUA_AUDITOR",
  "AUDITEE",
  "VERIFIKATOR",
  "PIMPINAN",
];

/**
 * Compatibility adapter for pages that still call /legacy/* routes.
 * New AMI workflow operations remain in the dedicated controllers.
 */
@Controller("legacy")
export class LegacyBootstrapController {
  constructor(private readonly prisma: PrismaService) {}

  private workspaceWhere(user: any) {
    const globalRoles = ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"];
    return user.roleCodes.some((role: string) => globalRoles.includes(role))
      ? {}
      : {
          OR: [
            { unitId: user.unitId ?? "__NONE__" },
            { team: { some: { userId: user.id } } },
          ],
        };
  }

  @Get("bootstrap")
  async bootstrap(@CurrentUser() user: any) {
    const [units, roles, modules] = await Promise.all([
      this.prisma.unit.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.role.findMany({
        where: { code: { in: ACTIVE_ROLE_CODES } },
        orderBy: { name: "asc" },
      }),
      this.prisma.masterQuestion.groupBy({
        by: ["moduleCode"],
        where: { active: true },
        _count: true,
        orderBy: { moduleCode: "asc" },
      }),
    ]);

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.roleCodes,
        unitId: user.unitId,
        isUnitApprover: user.isUnitApprover,
      },
      units,
      roles,
      modules,
    };
  }

  @Get("audit-programs")
  listPrograms() {
    return this.prisma.auditProgram.findMany({
      include: { _count: { select: { workspaces: true } } },
      orderBy: { startDate: "desc" },
    });
  }

  @Post("audit-programs")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  createProgram(@Body() body: any) {
    return this.prisma.auditProgram.create({
      data: {
        code: body.code,
        name: body.name,
        auditYear: Number(body.auditYear),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: body.status ?? "DRAFT",
      },
    });
  }

  @Get("evidences")
  listEvidences(@CurrentUser() user: any) {
    return this.prisma.evidence.findMany({
      where: {
        workspace: { is: this.workspaceWhere(user) as any },
        deletedAt: null,
      },
      include: {
        workspace: { include: { unit: true } },
        auditQuestion: true,
        uploadedBy: { select: { fullName: true } },
      },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    });
  }

  @Get("assessments")
  listAssessments(@CurrentUser() user: any) {
    return this.prisma.selfAssessment.findMany({
      where: {
        question: {
          workspace: { is: this.workspaceWhere(user) as any },
        },
      },
      include: {
        question: { include: { workspace: { include: { unit: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  @Get("workpapers")
  listWorkpapers(@CurrentUser() user: any) {
    return this.prisma.workpaper.findMany({
      where: {
        question: {
          workspace: { is: this.workspaceWhere(user) as any },
        },
      },
      include: {
        question: { include: { workspace: { include: { unit: true } } } },
        auditor: { select: { fullName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  @Get("findings")
  listFindings(@CurrentUser() user: any) {
    return this.prisma.finding.findMany({
      where: { workspace: { is: this.workspaceWhere(user) as any } },
      include: {
        workspace: { include: { unit: true } },
        actions: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("actions")
  listActions(@CurrentUser() user: any) {
    return this.prisma.correctiveAction.findMany({
      where: { workspace: { is: this.workspaceWhere(user) as any } },
      include: {
        finding: true,
        workspace: { include: { unit: true } },
        verifications: true,
      },
      orderBy: { targetDate: "asc" },
      take: 200,
    });
  }

  @Get("workspaces/:id/summary")
  async workspaceSummary(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.prisma.auditWorkspace.findFirstOrThrow({
      where: { id, ...this.workspaceWhere(user) },
      include: {
        unit: true,
        team: {
          include: {
            user: { select: { id: true, fullName: true, username: true } },
          },
        },
        _count: {
          select: {
            questions: true,
            evidences: true,
            findings: true,
            actions: true,
          },
        },
      },
    });
    const answered = await this.prisma.selfAssessment.count({
      where: {
        question: { workspaceId: id },
        response: { not: null },
      },
    });
    return { ...workspace, answered };
  }

  @Get("questions")
  questions(
    @Query("q") query = "",
    @Query("module") module = "",
    @Query("page") pageValue = "1",
    @Query("limit") limitValue = "50",
  ) {
    const page = Math.max(1, Number(pageValue));
    const take = Math.min(100, Math.max(10, Number(limitValue)));
    const skip = (page - 1) * take;
    const where: any = { active: true };
    if (module) where.moduleCode = module;
    if (query) {
      where.OR = [
        { code: { contains: query } },
        { question: { contains: query } },
      ];
    }
    return Promise.all([
      this.prisma.masterQuestion.findMany({
        where,
        include: { standard: true, isoClause: true },
        orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
        skip,
        take,
      }),
      this.prisma.masterQuestion.count({ where }),
    ]).then(([data, total]) => ({ data, total, page, limit: take }));
  }
}
