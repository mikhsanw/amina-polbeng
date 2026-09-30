import { PrismaService } from "./prisma.service";
export declare class AppService {
    readonly p: PrismaService;
    constructor(p: PrismaService);
    login(username: string, password: string, ip?: string, ua?: string): Promise<{
        token: string;
        hours: number;
        user: {
            id: string;
            username: string;
            fullName: string;
            mustChangePassword: boolean;
            roles: string[];
            permissions: string[];
            unit: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                code: string;
                slug: string;
                active: boolean;
            } | null;
            unitId: string | null;
            isUnitApprover: boolean;
        };
    }>;
    log(userId: string | undefined, username: string | undefined, action: string, entityType: string, entityId: string | null, workspaceId: string | null, newValue?: unknown, oldValue?: unknown): Promise<void>;
    createWorkspace(data: any, user: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        status: import(".prisma/client").$Enums.WorkspaceStatus;
        unitId: string;
        updatedAt: Date;
        auditYear: number;
        programId: string | null;
        instrumentStatus: import(".prisma/client").$Enums.ReviewStatus;
        instrumentVersion: number;
        instrumentChangeCount: number;
    }>;
    generateInstrument(workspaceId: string, user: any): Promise<{
        count: number;
        unitCode: string;
    }>;
}
