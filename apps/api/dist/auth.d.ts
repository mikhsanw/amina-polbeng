import { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "./prisma.service";
export declare const Public: () => import("@nestjs/common").CustomDecorator<string>;
export declare const Roles: (...roles: string[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const Permissions: (...permissions: string[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const CurrentUser: (...dataOrPipes: any[]) => ParameterDecorator;
export declare const tokenHash: (value: string) => string;
export declare const newToken: () => string;
export declare class AuthGuard implements CanActivate {
    private readonly prisma;
    private readonly reflector;
    constructor(prisma: PrismaService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
