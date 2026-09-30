import { PrismaService } from "./prisma.service";
export declare class UserActivityController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(yearValue?: string): Promise<{
        year: number;
        generatedAt: Date;
        rows: {
            id: string;
            username: string;
            fullName: string;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
            unit: {
                name: string;
                code: string;
            } | null;
            roles: string[];
            assignedWorkspaces: number;
            assignmentRoles: string[];
            assignedUnits: string[];
            actionCount: number;
            actionCounts: {
                instrument: number;
                selfAssessment: number;
                fieldAudit: number;
                followUp: number;
                other: number;
            };
            lastActivity: Date | null;
            missedDeadlines: number;
            activityStatus: string;
        }[];
        summary: {
            users: number;
            assignedUsers: number;
            activeUsers: number;
            usersWithMissedDeadlines: number;
        };
    }>;
}
