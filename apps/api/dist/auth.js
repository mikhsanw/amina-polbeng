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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = exports.newToken = exports.tokenHash = exports.CurrentUser = exports.Permissions = exports.Roles = exports.Public = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("./prisma.service");
const Public = () => (0, common_1.SetMetadata)("public", true);
exports.Public = Public;
const Roles = (...roles) => (0, common_1.SetMetadata)("roles", roles);
exports.Roles = Roles;
const Permissions = (...permissions) => (0, common_1.SetMetadata)("permissions", permissions);
exports.Permissions = Permissions;
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, context) => context.switchToHttp().getRequest().user);
const tokenHash = (value) => (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
exports.tokenHash = tokenHash;
const newToken = () => (0, node_crypto_1.randomBytes)(32).toString("base64url");
exports.newToken = newToken;
let AuthGuard = class AuthGuard {
    prisma;
    reflector;
    constructor(prisma, reflector) {
        this.prisma = prisma;
        this.reflector = reflector;
    }
    async canActivate(context) {
        if (this.reflector.getAllAndOverride("public", [
            context.getHandler(),
            context.getClass(),
        ])) {
            return true;
        }
        const request = context
            .switchToHttp()
            .getRequest();
        const token = request.cookies?.sami_session;
        if (!token)
            throw new common_1.UnauthorizedException("Sesi tidak ditemukan.");
        const session = await this.prisma.session.findFirst({
            where: {
                tokenHash: (0, exports.tokenHash)(token),
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
            throw new common_1.UnauthorizedException("Sesi tidak aktif.");
        }
        const roleCodes = session.user.roles.map((item) => item.role.code);
        const permissionCodes = new Set();
        for (const userRole of session.user.roles) {
            for (const rolePermission of userRole.role.permissions) {
                permissionCodes.add(rolePermission.permission.code);
            }
        }
        const requiredRoles = this.reflector.getAllAndOverride("roles", [
            context.getHandler(),
            context.getClass(),
        ]);
        if (requiredRoles?.length &&
            !requiredRoles.some((role) => roleCodes.includes(role))) {
            throw new common_1.ForbiddenException("Akses role ditolak.");
        }
        const requiredPermissions = this.reflector.getAllAndOverride("permissions", [context.getHandler(), context.getClass()]);
        if (requiredPermissions?.length &&
            !permissionCodes.has("*") &&
            !requiredPermissions.every((permission) => permissionCodes.has(permission))) {
            throw new common_1.ForbiddenException("Permission untuk tindakan ini tidak tersedia.");
        }
        request.user = {
            ...session.user,
            roleCodes,
            permissionCodes: [...permissionCodes],
            sessionId: session.id,
        };
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.Reflector])
], AuthGuard);
//# sourceMappingURL=auth.js.map