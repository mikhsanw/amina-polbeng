import { AmiWorkflowService } from "./ami-workflow.service";
import { AuditScheduleService } from "./audit-schedule.service";
export declare class FieldAuditDecisionController {
    private readonly flow;
    private readonly schedule;
    constructor(flow: AmiWorkflowService, schedule: AuditScheduleService);
    decide(id: string, body: any, user: any): Promise<{
        ok: boolean;
        status: string;
        sourceType: string;
        result: any;
        requiresFinding: boolean;
        findingType: any;
        dueDate: string | null;
    }>;
}
