import { AmiWorkflowService } from "./ami-workflow.service";
export declare class ReportSignatoryController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    signatories(id: string, user: any): Promise<{
        auditee: {
            id: string;
            fullName: string;
        } | null;
        leadAuditor: {
            id: string;
            fullName: string;
        } | null;
        auditors: {
            id: string;
            fullName: string;
        }[];
    }>;
}
