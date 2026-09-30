import { StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { AmiWorkflowService } from "./ami-workflow.service";
export declare class EvidenceFileController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    openFile(id: string, download: string | undefined, user: any, response: Response): Promise<StreamableFile | void>;
}
