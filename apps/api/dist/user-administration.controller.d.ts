import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
export declare class UserAdministrationController {
    private readonly prisma;
    private readonly app;
    constructor(prisma: PrismaService, app: AppService);
    list(): import(".prisma/client").Prisma.PrismaPromise<{
        unit: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        } | null;
        id: string;
        username: string;
        fullName: string;
        email: string | null;
        status: import(".prisma/client").$Enums.AccountStatus;
        mustChangePassword: boolean;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        isUnitApprover: boolean;
        updatedAt: Date;
        roles: ({
            role: {
                id: string;
                name: string;
                code: string;
            };
        } & {
            userId: string;
            roleId: string;
        })[];
    }[]>;
    resetLogin(id: string, admin: any): Promise<{
        id: string;
        username: string;
        status: import(".prisma/client").$Enums.AccountStatus;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
    }>;
    resetPassword(id: string, body: any, admin: any): Promise<{
        ok: boolean;
        mustChangePassword: boolean;
    }>;
    remove(id: string, admin: any): Promise<{
        ok: boolean;
        id: string;
        alreadyDeleted: boolean;
        deletedAt: string;
        status?: undefined;
        removedPlanAssignments?: undefined;
        preservedHistoricalRecords?: undefined;
    } | {
        ok: boolean;
        id: string;
        status: import(".prisma/client").$Enums.AccountStatus;
        deletedAt: string;
        removedPlanAssignments: number;
        preservedHistoricalRecords: number;
        alreadyDeleted?: undefined;
    }>;
}
