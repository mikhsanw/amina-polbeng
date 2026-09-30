import type { Response } from "express";
import { AmiWorkflowService } from "./ami-workflow.service";
export declare class ReportDocumentController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    download(id: string, download: string | undefined, user: any, response: Response): Promise<void>;
}
