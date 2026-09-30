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
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { CurrentUser, Roles } from "./auth";
import { AppService } from "./app.service";
import { AmiWorkflowService } from "./ami-workflow.service";

function programInput(body: any, partial = false) {
  const code =
    body.code == null ? undefined : String(body.code).trim().toUpperCase();
  const name = body.name == null ? undefined : String(body.name).trim();
  const auditYear = body.auditYear == null ? undefined : Number(body.auditYear);
  const startDate =
    body.startDate == null ? undefined : new Date(body.startDate);
  const endDate = body.endDate == null ? undefined : new Date(body.endDate);

  if (
    !partial &&
    (!code || !name || auditYear == null || !startDate || !endDate)
  ) {
    throw new BadRequestException(
      "Kode, nama, tahun, tanggal mulai, dan tanggal selesai wajib diisi.",
    );
  }
  if (
    auditYear != null &&
    (!Number.isInteger(auditYear) || auditYear < 2000 || auditYear > 2100)
  ) {
    throw new BadRequestException("Tahun audit tidak valid.");
  }
  if (startDate && Number.isNaN(startDate.getTime())) {
    throw new BadRequestException("Tanggal mulai tidak valid.");
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new BadRequestException("Tanggal selesai tidak valid.");
  }
  if (startDate && endDate && endDate < startDate) {
    throw new BadRequestException(
      "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
    );
  }
  return { code, name, auditYear, startDate, endDate, status: body.status };
}

@Controller()
export class AuditPlanningController {
  constructor(
    private readonly flow: AmiWorkflowService,
    private readonly app: AppService,
  ) {}

  @Get("audit-programs")
  listPrograms() {
    return this.flow.prisma.auditProgram.findMany({
      include: { _count: { select: { workspaces: true } } },
      orderBy: { startDate: "desc" },
    });
  }

  @Post("audit-programs")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  createProgram(@Body() body: any) {
    const data = programInput(body);
    return this.flow.prisma.auditProgram.create({
      data: {
        code: data.code!,
        name: data.name!,
        auditYear: data.auditYear!,
        startDate: data.startDate!,
        endDate: data.endDate!,
        status: data.status ?? "DRAFT",
      },
    });
  }

  @Patch("audit-programs/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async updateProgram(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const before = await this.flow.prisma.auditProgram.findUniqueOrThrow({
      where: { id },
    });
    this.flow.requireStatus(before.status, ["DRAFT", "PLANNED"]);
    const data = programInput(body, true);
    const effectiveStart = data.startDate ?? before.startDate;
    const effectiveEnd = data.endDate ?? before.endDate;
    if (effectiveEnd < effectiveStart) {
      throw new BadRequestException(
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
      );
    }
    const after = await this.flow.prisma.auditProgram.update({
      where: { id },
      data,
    });
    await this.flow.log(
      user.id,
      user.username,
      "AUDIT_PROGRAM_UPDATED",
      "AuditProgram",
      id,
      null,
      after,
      before,
    );
    return after;
  }

  @Delete("audit-programs/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async deleteProgram(
    @Param("id") id: string,
    @Query("cascade") cascadeValue = "false",
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
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
      throw new BadRequestException(
        `Program mempunyai ${program.workspaces.length} ruang kerja. Gunakan konfirmasi hapus beserta transaksi.`,
      );
    }
    if (cascade && body?.confirmation !== program.code) {
      throw new BadRequestException(
        `Ketik kode program ${program.code} sebagai konfirmasi penghapusan.`,
      );
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

    const storageRoot = resolve(process.cwd(), "storage");
    for (const storageKey of storageKeys) {
      const target = resolve(process.cwd(), storageKey);
      if (target.startsWith(storageRoot))
        await unlink(target).catch(() => undefined);
    }
    await this.flow.log(
      user.id,
      user.username,
      "AUDIT_PROGRAM_DELETED",
      "AuditProgram",
      id,
      null,
      { code: program.code, deletedWorkspaces: workspaceIds.length },
    );
    return { ok: true, deletedWorkspaces: workspaceIds.length };
  }

  @Get("audit-workspaces")
  listWorkspaces(@CurrentUser() user: any) {
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

  @Post("audit-workspaces")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  createWorkspace(@Body() body: any, @CurrentUser() user: any) {
    return this.app.createWorkspace(body, user);
  }

  @Get("audit-workspaces/:id")
  oneWorkspace(@Param("id") id: string, @CurrentUser() user: any) {
    return this.flow.workspace(id, user);
  }

  @Delete("audit-workspaces/:id")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async deleteWorkspace(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    this.flow.requireStatus(workspace.status, ["DRAFT", "FILE_PREPARATION"]);
    await this.flow.prisma.auditWorkspace.delete({ where: { id } });
    return { ok: true };
  }

  @Post("audit-workspaces/:id/generate-instrument")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  generateInstrument(@Param("id") id: string, @CurrentUser() user: any) {
    return this.app.generateInstrument(id, user);
  }

  @Get("audit-workspaces/:id/questions")
  async questions(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Query("page") pageValue = "1",
    @Query("limit") limitValue = "25",
  ) {
    await this.flow.workspace(id, user);
    const page = Math.max(1, Number(pageValue));
    const take = Math.min(100, Math.max(10, Number(limitValue)));
    const auditeeOnly =
      user.roleCodes.includes("AUDITEE") &&
      !this.flow.hasRole(user, [
        "AUDITOR",
        "KETUA_AUDITOR",
        "ADMIN_MUTU",
        "SUPER_ADMIN",
      ]);
    const where: any = {
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

  @Get("audit-flow/:id")
  async detail(@Param("id") id: string, @CurrentUser() user: any) {
    const workspace = await this.flow.workspace(id, user);
    const auditeeOnly =
      user.roleCodes.includes("AUDITEE") &&
      !this.flow.hasRole(user, [
        "AUDITOR",
        "KETUA_AUDITOR",
        "ADMIN_MUTU",
        "SUPER_ADMIN",
      ]);
    const [
      questions,
      evidences,
      workpapers,
      findings,
      actions,
      prints,
      users,
      availableInstrumentCount,
    ] = await Promise.all([
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

  @Post("audit-flow/workspaces/:id/team")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async addTeam(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
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
    const assignmentRole =
      body.role === "KETUA_AUDITOR" ? "LEAD_AUDITOR" : body.role;
    const requiredSystemRoles: Record<string, string[]> = {
      LEAD_AUDITOR: ["KETUA_AUDITOR"],
      AUDITOR: ["AUDITOR", "KETUA_AUDITOR"],
      VERIFIER: ["VERIFIKATOR"],
    };
    if (
      !requiredSystemRoles[assignmentRole]?.some((role) =>
        roleCodes.includes(role),
      )
    ) {
      throw new BadRequestException(
        "Role sistem personel tidak sesuai penugasan.",
      );
    }
    if (member.unitId === workspace.unitId) {
      throw new BadRequestException(
        "Konflik kepentingan: personel berasal dari unit auditee.",
      );
    }
    const existingOtherRole = await this.flow.prisma.auditTeam.findFirst({
      where: { workspaceId: id, userId: member.id },
    });
    if (existingOtherRole && existingOtherRole.role !== assignmentRole) {
      throw new BadRequestException(
        "Personel sudah mempunyai penugasan lain pada workspace ini.",
      );
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

  @Delete("audit-flow/workspaces/:id/team/:teamId")
  @Roles("SUPER_ADMIN", "ADMIN_MUTU")
  async removeTeam(
    @Param("id") id: string,
    @Param("teamId") teamId: string,
    @CurrentUser() user: any,
  ) {
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
      throw new BadRequestException(
        "Penugasan tidak berasal dari ruang kerja ini.",
      );
    }
    await this.flow.prisma.auditTeam.delete({ where: { id: teamId } });
    return { ok: true };
  }
}
