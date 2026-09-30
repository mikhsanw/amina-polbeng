import { AmiWorkflowService } from "./ami-workflow.service";
export declare class DeadlineTransitionController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    private notifyAdmin;
    private notifyAuditee;
    activateInstrument(id: string, body: any, user: any): Promise<{
        status: string;
        ok: boolean;
        count: number;
    }>;
    submitReviewToAdmin(id: string, user: any): Promise<{
        ok: boolean;
        status: string;
    }>;
}
