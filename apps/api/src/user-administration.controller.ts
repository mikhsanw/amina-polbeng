import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import argon2 from "argon2";
import { CurrentUser, Roles } from "./auth";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";

@Controller("user-admin")
@Roles("SUPER_ADMIN", "ADMIN_MUTU")
export class UserAdministrationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
  ) {}

  @Get("users")
  list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        status: true,
        mustChangePassword: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        updatedAt: true,
        isUnitApprover: true,
        unit: true,
        roles: { include: { role: true } },
      },
      orderBy: { fullName: "asc" },
    });
  }

  @Post("users/:id/reset-login")
  async resetLogin(
    @Param("id") id: string,
    @CurrentUser() admin: any,
  ) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (before.deletedAt) {
      throw new BadRequestException("Akun sudah dihapus.");
    }
    const after = await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: before.status === "LOCKED" ? "ACTIVE" : undefined,
      },
      select: {
        id: true,
        username: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });
    await this.app.log(
      admin.id,
      admin.username,
      "USER_LOGIN_RESET",
      "User",
      id,
      null,
      after,
      {
        failedLoginAttempts: before.failedLoginAttempts,
        lockedUntil: before.lockedUntil?.toISOString() ?? null,
      },
    );
    return after;
  }

  @Post("users/:id/reset-password")
  async resetPassword(
    @Param("id") id: string,
    @Body() body: any,
    @CurrentUser() admin: any,
  ) {
    const password = String(body.password ?? "");
    if (password.length < 8) {
      throw new BadRequestException("Password sementara minimal 8 karakter.");
    }
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (before.deletedAt) {
      throw new BadRequestException("Akun sudah dihapus.");
    }
    const passwordHash = await argon2.hash(password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.app.log(
      admin.id,
      admin.username,
      "USER_PASSWORD_RESET",
      "User",
      id,
      null,
      { mustChangePassword: true },
      { mustChangePassword: before.mustChangePassword },
    );
    return { ok: true, mustChangePassword: true };
  }

  @Delete("users/:id")
  async remove(
    @Param("id") id: string,
    @CurrentUser() admin: any,
  ) {
    if (id === admin.id) {
      throw new BadRequestException(
        "Akun yang sedang digunakan tidak dapat dihapus.",
      );
    }

    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    // DELETE dibuat idempotent. Permintaan ulang tidak menghasilkan error palsu.
    if (before.deletedAt) {
      return {
        ok: true,
        id,
        alreadyDeleted: true,
        deletedAt: before.deletedAt.toISOString(),
      };
    }

    const isSuperAdmin = before.roles.some(
      (mapping) => mapping.role.code === "SUPER_ADMIN",
    );
    if (isSuperAdmin) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: {
          id: { not: id },
          status: "ACTIVE",
          deletedAt: null,
          roles: { some: { role: { code: "SUPER_ADMIN" } } },
        },
      });
      if (activeSuperAdmins === 0) {
        throw new BadRequestException(
          "Master Admin terakhir tidak dapat dihapus. Tetapkan Master Admin lain terlebih dahulu.",
        );
      }
    }

    const [workspaceAssignments, planAssignments, workpapers, evidences] =
      await Promise.all([
        this.prisma.auditTeam.count({ where: { userId: id } }),
        this.prisma.auditUnitPlanAssignment.count({ where: { userId: id } }),
        this.prisma.workpaper.count({ where: { auditorUserId: id } }),
        this.prisma.evidence.count({ where: { uploadedById: id } }),
      ]);

    const deletedAt = new Date();
    const archivedUsername = `deleted_${id}`;

    const result = await this.prisma.$transaction(async (transaction) => {
      // Penugasan rencana belum menjadi rekaman audit, sehingga dibersihkan.
      const removedPlanAssignments =
        await transaction.auditUnitPlanAssignment.deleteMany({
          where: { userId: id },
        });
      await transaction.userRole.deleteMany({ where: { userId: id } });
      await transaction.session.deleteMany({ where: { userId: id } });
      await transaction.notification.deleteMany({
        where: { recipientUserId: id },
      });

      const deletedUser = await transaction.user.update({
        where: { id },
        data: {
          username: archivedUsername,
          email: null,
          status: "INACTIVE",
          deletedAt,
          failedLoginAttempts: 0,
          lockedUntil: null,
          isUnitApprover: false,
        },
        select: {
          id: true,
          status: true,
          deletedAt: true,
        },
      });

      await transaction.activityLog.create({
        data: {
          userId: admin.id,
          username: admin.username,
          action: "USER_DELETED",
          entityType: "User",
          entityId: id,
          workspaceId: null,
          result: "SUCCESS",
          oldValue: {
            username: before.username,
            email: before.email,
            status: before.status,
          },
          newValue: {
            status: "INACTIVE",
            deletedAt: deletedAt.toISOString(),
            removedPlanAssignments: removedPlanAssignments.count,
            preservedWorkspaceAssignments: workspaceAssignments,
            preservedWorkpapers: workpapers,
            preservedEvidences: evidences,
          },
        },
      });

      return deletedUser;
    });

    return {
      ok: true,
      id: result.id,
      status: result.status,
      deletedAt: result.deletedAt?.toISOString() ?? deletedAt.toISOString(),
      removedPlanAssignments: planAssignments,
      preservedHistoricalRecords:
        workspaceAssignments + workpapers + evidences,
    };
  }
}
