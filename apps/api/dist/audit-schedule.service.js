"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditScheduleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
let AuditScheduleService = class AuditScheduleService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async plan(workspaceId) {
        return this.prisma.auditUnitPlan.findUnique({
            where: { workspaceId },
        });
    }
    phaseDeadline(plan, phase) {
        const deadlines = {
            INSTRUMENT_REVIEW: [
                plan?.instrumentReviewEnd ?? null,
                "telaah instrumen",
            ],
            INSTRUMENT_VERIFICATION: [
                plan?.instrumentVerificationEnd ?? null,
                "verifikasi instrumen",
            ],
            SELF_ASSESSMENT: [
                plan?.selfAssessmentEnd ?? null,
                "self-assessment",
            ],
            SELF_ASSESSMENT_REVIEW: [
                plan?.selfAssessmentReviewEnd ?? null,
                "review self-assessment",
            ],
            FIELD_AUDIT: [
                plan?.fieldAuditEnd ?? null,
                "assessment lapangan",
            ],
            REPORTING: [
                plan?.reportingEnd ?? null,
                "penyusunan laporan",
            ],
            FOLLOW_UP: [
                plan?.followUpEnd ?? null,
                "CAPA dan tindak lanjut",
            ],
        };
        return deadlines[phase];
    }
    async state(workspaceId, phase, at = new Date()) {
        const plan = await this.plan(workspaceId);
        if (!plan) {
            return {
                configured: false,
                open: true,
                before: false,
                after: false,
                start: null,
                end: null,
                deadline: null,
                label: phase,
            };
        }
        const [rawDeadline, label] = this.phaseDeadline(plan, phase);
        const deadline = rawDeadline ? new Date(rawDeadline) : null;
        deadline?.setUTCHours(23, 59, 59, 999);
        const configured = Boolean(deadline);
        const after = Boolean(deadline && at.getTime() > deadline.getTime());
        return {
            configured,
            open: !configured || !after,
            before: false,
            after,
            start: null,
            end: deadline,
            deadline,
            label,
        };
    }
    async requireOpen(workspaceId, phase) {
        const state = await this.state(workspaceId, phase);
        if (!state.open) {
            const formatter = new Intl.DateTimeFormat("id-ID", {
                dateStyle: "medium",
            });
            throw new common_1.BadRequestException(`Batas akhir tahap ${state.label} telah lewat pada ${formatter.format(state.deadline)}.`);
        }
        return state;
    }
    async detail(workspaceId) {
        return this.plan(workspaceId);
    }
};
exports.AuditScheduleService = AuditScheduleService;
exports.AuditScheduleService = AuditScheduleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditScheduleService);
//# sourceMappingURL=audit-schedule.service.js.map