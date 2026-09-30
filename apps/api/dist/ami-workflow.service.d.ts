import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
export declare class AmiWorkflowService {
    readonly prisma: PrismaService;
    private readonly app;
    constructor(prisma: PrismaService, app: AppService);
    isGlobal(user: any): any;
    hasRole(user: any, roles: string[]): any;
    requireStatus(status: string, allowed: string[]): void;
    workspace(id: string, user: any): Promise<{
        unit: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            code: string;
            slug: string;
            active: boolean;
        };
        program: {
            id: string;
            createdAt: Date;
            name: string;
            status: string;
            updatedAt: Date;
            code: string;
            auditYear: number;
            startDate: Date;
            endDate: Date;
        } | null;
        team: ({
            user: {
                unit: {
                    name: string;
                    code: string;
                } | null;
                id: string;
                username: string;
                fullName: string;
                unitId: string | null;
                isUnitApprover: boolean;
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
            };
        } & {
            role: string;
            id: string;
            userId: string;
            workspaceId: string;
        })[];
        _count: {
            evidences: number;
            questions: number;
            findings: number;
            actions: number;
        };
    } & {
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
    requireAssignment(workspace: any, user: any, roles: string[]): void;
    questionDefault(question: any): {
        question: any;
        expectedEvidence: any;
        testMethod: any;
        riskLevel: any;
        excluded: boolean;
    };
    questionProposal(question: any): {
        question: any;
        expectedEvidence: any;
        testMethod: any;
        riskLevel: any;
        excluded: any;
        exclusionReason: any;
    };
    notifyRole(workspaceId: string, assignmentRole: string, event: any, title: string, message: string, entityType: string, entityId: string): Promise<void>;
    publishInstrument(workspaceId: string, user: any, note?: string): Promise<{
        ok: boolean;
        count: number;
    }>;
    log(...args: Parameters<AppService["log"]>): Promise<void>;
}
