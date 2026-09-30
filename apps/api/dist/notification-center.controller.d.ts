import { PrismaService } from "./prisma.service";
export declare class NotificationCenterController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(user: any): Promise<{
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string;
        workspaceId: string | null;
        title: string;
        message: string;
        recipientUserId: string;
        readAt: Date | null;
        event: import(".prisma/client").$Enums.NotificationEvent;
    }[]>;
    markAllRead(user: any): import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.BatchPayload>;
    markRead(id: string, user: any): Promise<{
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string;
        workspaceId: string | null;
        title: string;
        message: string;
        recipientUserId: string;
        readAt: Date | null;
        event: import(".prisma/client").$Enums.NotificationEvent;
    }>;
}
