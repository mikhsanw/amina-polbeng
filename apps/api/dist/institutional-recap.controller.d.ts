import { Response } from "express";
import { AmiWorkflowService } from "./ami-workflow.service";
type RecapFilters = {
    year?: number;
    programId?: string;
    unitId?: string;
    moduleCode?: string;
};
export declare class InstitutionalRecapController {
    private readonly flow;
    constructor(flow: AmiWorkflowService);
    private parseFilters;
    private build;
    recap(query: Record<string, unknown>, _user: any): Promise<{
        generatedAt: string;
        appliedFilters: RecapFilters;
        filters: {
            years: number[];
            programs: {
                id: string;
                name: string;
                code: string;
                auditYear: number;
            }[];
            units: {
                id: string;
                name: string;
                code: string;
            }[];
            modules: string[];
        };
        kpis: {
            unitsAudited: number;
            totalQuestions: any;
            totalFindings: number;
            openFindings: number;
            closedFindings: number;
            capaTotal: number;
            capaEffective: number;
            capaOverdue: number;
            avgCapaProgress: number;
            closureRate: number;
        };
        findingsByUnit: {
            workspaceId: any;
            unitId: any;
            unitCode: any;
            unitName: any;
            auditYear: any;
            programName: any;
            questionCount: any;
            total: any;
            open: any;
            closed: number;
            major: any;
            minor: any;
            observation: any;
            findingRate: number;
            capaTotal: any;
            capaEffective: any;
            capaOverdue: any;
            avgProgress: number;
        }[];
        capaByStatus: {
            status: string;
            label: string;
            count: number;
        }[];
        unitProgress: {
            workspaceId: any;
            unitId: any;
            unitCode: any;
            unitName: any;
            auditYear: any;
            programName: any;
            questionCount: any;
            total: any;
            open: any;
            closed: number;
            major: any;
            minor: any;
            observation: any;
            findingRate: number;
            capaTotal: any;
            capaEffective: any;
            capaOverdue: any;
            avgProgress: number;
        }[];
        heatmap: {
            units: {
                id: any;
                code: any;
                name: any;
            }[];
            rows: {
                moduleCode: any;
                cells: {
                    unitId: any;
                    count: any;
                    open: any;
                    major: any;
                }[];
            }[];
            maxCount: number;
        };
        overdueCapa: {
            id: any;
            findingCode: any;
            findingType: any;
            unitCode: any;
            unitName: any;
            moduleCode: any;
            correctiveAction: any;
            rootCause: any;
            successIndicator: any;
            targetDate: any;
            daysLate: number;
            progressPercent: any;
            status: any;
        }[];
        auditorInsights: {
            findingId: any;
            findingCode: any;
            unitCode: any;
            unitName: any;
            moduleCode: any;
            findingType: any;
            status: any;
            condition: any;
            riskImpact: any;
            auditorName: any;
            auditorAnalysis: any;
            recommendation: any;
            capaStatus: any;
            progressPercent: any;
        }[];
        workPlan: {
            priority: string;
            moduleCode: any;
            affectedUnits: any[];
            findingCount: any;
            openCount: any;
            majorCount: any;
            overdueCount: any;
            recommendedAction: any;
            successIndicator: any;
            targetDate: Date | null;
        }[];
    }>;
    exportExcel(query: Record<string, unknown>, response: Response): Promise<void>;
    exportPdf(query: Record<string, unknown>, response: Response): Promise<void>;
}
export {};
