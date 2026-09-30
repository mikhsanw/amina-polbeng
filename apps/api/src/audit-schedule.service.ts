import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

export type AuditPhase =
  | "INSTRUMENT_REVIEW"
  | "INSTRUMENT_VERIFICATION"
  | "SELF_ASSESSMENT"
  | "SELF_ASSESSMENT_REVIEW"
  | "FIELD_AUDIT"
  | "REPORTING"
  | "FOLLOW_UP";

@Injectable()
export class AuditScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async plan(workspaceId: string) {
    return this.prisma.auditUnitPlan.findUnique({
      where: { workspaceId },
    });
  }

  private phaseDeadline(plan: any, phase: AuditPhase) {
    const deadlines: Record<AuditPhase, [Date | null, string]> = {
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

  async state(workspaceId: string, phase: AuditPhase, at = new Date()) {
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

  async requireOpen(workspaceId: string, phase: AuditPhase) {
    const state = await this.state(workspaceId, phase);
    if (!state.open) {
      const formatter = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
      });
      throw new BadRequestException(
        `Batas akhir tahap ${state.label} telah lewat pada ${formatter.format(state.deadline!)}.`,
      );
    }
    return state;
  }

  async detail(workspaceId: string) {
    return this.plan(workspaceId);
  }
}
