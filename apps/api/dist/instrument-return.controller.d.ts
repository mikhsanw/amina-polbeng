import { AmiWorkflowService } from "./ami-workflow.service";
export declare class InstrumentReturnController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    returnReview(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
        invalid: number;
    }>;
}
