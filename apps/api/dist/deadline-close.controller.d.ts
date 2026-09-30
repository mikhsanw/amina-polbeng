import { AmiWorkflowService } from "./ami-workflow.service";
export declare class DeadlineCloseController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    close(id: string, user: any): Promise<{
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
}
