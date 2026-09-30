import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare class FieldCorrectionSubmitController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    submit(id: string, user: any): Promise<{
        ok: boolean;
        count: number;
        status: string;
    }>;
}
