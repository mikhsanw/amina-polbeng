import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash, randomBytes } from "node:crypto";
import { Request } from "express";
import { PrismaService } from "./prisma.service";

export const Public = () => SetMetadata("public", true);
export const Roles = (...roles: string[]) => SetMetadata("roles", roles);
export const Permissions = (...permissions: string[]) =>
  SetMetadata("permissions", permissions);
export const CurrentUser = createParamDecorator((_data, context) =>
  context.switchToHttp().getRequest().user,
);
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>("public", [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const token = request.cookies?.sami_session;
    if (!token) throw new UnauthorizedException("Sesi tidak ditemukan.");

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: tokenHash(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
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
          },
        },
      },
    });
    if (!session || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Sesi tidak aktif.");
    }

    const roleCodes = session.user.roles.map((item) => item.role.code);
    const permissionCodes = new Set<string>();
    for (const userRole of session.user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        permissionCodes.add(rolePermission.permission.code);
      }
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      requiredRoles?.length &&
      !requiredRoles.some((role) => roleCodes.includes(role))
    ) {
      throw new ForbiddenException("Akses role ditolak.");
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      "permissions",
      [context.getHandler(), context.getClass()],
    );
    if (
      requiredPermissions?.length &&
      !permissionCodes.has("*") &&
      !requiredPermissions.every((permission) =>
        permissionCodes.has(permission),
      )
    ) {
      throw new ForbiddenException("Permission untuk tindakan ini tidak tersedia.");
    }

    request.user = {
      ...session.user,
      roleCodes,
      permissionCodes: [...permissionCodes],
      sessionId: session.id,
    };
    return true;
  }
}
