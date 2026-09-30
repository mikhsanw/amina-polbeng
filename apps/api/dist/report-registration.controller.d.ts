import { AmiWorkflowService } from "./ami-workflow.service";
export declare class ReportRegistrationController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    register(id: string, body: any, user: any): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        workspaceId: string;
        version: number;
        fileName: string;
        storageKey: string;
        type: string;
    }>;
    remove(id: string, user: any): Promise<{
        ok: boolean;
        deletedId: string;
    }>;
}
