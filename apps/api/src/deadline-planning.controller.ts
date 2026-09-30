import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";

function optionalDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Tanggal ${String(value)} tidak valid.`);
  }
  return date;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function systemRoles(user: any): string[] {
  return (user.roles || []).map((item: any) => String(item.role.code));
}

@Controller("audit-programs/:programId/deadline-unit-plans")
@Roles("SUPER_ADMIN", "ADMIN_MUTU")
export class DeadlinePlanningController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
  ) {}

  private async detail(programId: string, planId: string) {
    const plan = await this.prisma.auditUnitPlan.findUniqueOrThrow({
      where: { id: planId },
    });
    if (plan.programId !== programId) {
      throw new BadRequestException("Rencana unit tidak berasal dari program ini.");
    }
    const [program, unit, assignments, links, workspace] = await Promise.all([
      this.prisma.auditProgram.findUniqueOrThrow({ where: { id: programId } }),
      this.prisma.unit.findUniqueOrThrow({ where: { id: plan.unitId } }),
      this.prisma.auditUnitPlanAssignment.findMany({ where: { planId } }),
      this.prisma.auditUnitPlanQuestion.findMany({ where: { planId } }),
      plan.workspaceId
        ? this.prisma.auditWorkspace.findUnique({ where: { id: plan.workspaceId } })
        : null,
    ]);
    const questionIds = links.map((item) => item.questionId);
    const questions = questionIds.length
      ? await this.prisma.masterQuestion.findMany({
          where: { id: { in: questionIds }, active: true },
        })
      : [];
    return { ...plan, program, unit, assignments, questions, workspace };
  }

  private ready(plan: any) {
    return (
      plan.included &&
      !plan.workspaceId &&
      plan.questions.length > 0 &&
      plan.assignments.some((item: any) => item.role === "LEAD_AUDITOR") &&
      plan.assignments.some((item: any) => item.role === "AUDITOR") &&
      plan.assignments.some((item: any) => item.role === "VERIFIER") &&
      Boolean(plan.instrumentReviewEnd) &&
      Boolean(plan.instrumentVerificationEnd)
    );
  }

  private validateDeadline(
    date: Date | null,
    program: { startDate: Date; endDate: Date },
    label: string,
  ) {
    if (!date) return;
    const start = new Date(program.startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(program.endDate);
    end.setUTCHours(23, 59, 59, 999);
    const deadline = new Date(date);
    deadline.setUTCHours(23, 59, 59, 999);
    if (deadline.getTime() < start.getTime() || deadline.getTime() > end.getTime()) {
      throw new BadRequestException(
        `${label} harus berada dalam rentang program audit.`,
      );
    }
  }

  @Put(":planId")
  async save(
    @Param("programId") programId: string,
    @Param("planId") planId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const before = await this.detail(programId, planId);
    if (before.workspaceId) {
      throw new BadRequestException(
        "Ruang kerja telah dibentuk. Rencana awal tidak dapat diubah dari matriks.",
      );
    }

    const included = body.included !== false;
    const instrumentReviewEnd = optionalDate(body.instrumentReviewEnd);
    const instrumentVerificationEnd = optionalDate(body.instrumentVerificationEnd);
    this.validateDeadline(
      instrumentReviewEnd,
      before.program,
      "Batas submit telaah instrumen",
    );
    this.validateDeadline(
      instrumentVerificationEnd,
      before.program,
      "Batas keputusan Verifikator",
    );
    if (
      instrumentReviewEnd &&
      instrumentVerificationEnd &&
      instrumentVerificationEnd.getTime() < instrumentReviewEnd.getTime()
    ) {
      throw new BadRequestException(
        "Batas keputusan Verifikator tidak boleh lebih awal dari batas submit telaah.",
      );
    }

    const leadAuditorId = String(body.leadAuditorId || "").trim() || null;
    const verifierId = String(body.verifierId || "").trim() || null;
    const auditorIds = uniqueStrings(body.auditorIds);
    const assignmentIds = [leadAuditorId, verifierId, ...auditorIds].filter(
      (item): item is string => Boolean(item),
    );
    if (new Set(assignmentIds).size !== assignmentIds.length) {
      throw new BadRequestException(
        "Satu pengguna tidak boleh memegang lebih dari satu peran pada unit yang sama.",
      );
    }
    const users = assignmentIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assignmentIds }, status: "ACTIVE", deletedAt: null },
          include: { roles: { include: { role: true } } },
        })
      : [];
    if (users.length !== assignmentIds.length) {
      throw new BadRequestException("Personel tidak aktif atau tidak ditemukan.");
    }
    const usersById = new Map(users.map((item) => [item.id, item]));
    const validatePerson = (
      id: string | null,
      allowed: string[],
      label: string,
    ) => {
      if (!id) return;
      const selected = usersById.get(id);
      if (!selected || !allowed.some((role) => systemRoles(selected).includes(role))) {
        throw new BadRequestException(`${label} tidak memiliki role yang sesuai.`);
      }
      if (selected.unitId === before.unitId) {
        throw new BadRequestException(
          `${label} berasal dari unit Auditee dan menimbulkan konflik kepentingan.`,
        );
      }
    };
    validatePerson(leadAuditorId, ["KETUA_AUDITOR"], "Ketua Auditor");
    validatePerson(verifierId, ["VERIFIKATOR"], "Verifikator");
    for (const auditorId of auditorIds) {
      validatePerson(auditorId, ["AUDITOR", "KETUA_AUDITOR"], "Auditor");
    }

    const questionIds = uniqueStrings(body.questionIds);
    if (questionIds.length) {
      const valid = await this.prisma.masterQuestion.count({
        where: { id: { in: questionIds }, active: true },
      });
      if (valid !== questionIds.length) {
        throw new BadRequestException(
          "Sebagian instrumen tidak aktif atau tidak ditemukan.",
        );
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.auditUnitPlan.update({
        where: { id: planId },
        data: {
          included,
          status: included ? "DRAFT" : "EXCLUDED",
          instrumentReviewStart: null,
          instrumentReviewEnd,
          instrumentVerificationStart: null,
          instrumentVerificationEnd,
        },
      });
      await transaction.auditUnitPlanAssignment.deleteMany({ where: { planId } });
      const assignments = [
        ...(leadAuditorId
          ? [{ planId, userId: leadAuditorId, role: "LEAD_AUDITOR" }]
          : []),
        ...auditorIds.map((userId) => ({ planId, userId, role: "AUDITOR" })),
        ...(verifierId
          ? [{ planId, userId: verifierId, role: "VERIFIER" }]
          : []),
      ];
      if (assignments.length) {
        await transaction.auditUnitPlanAssignment.createMany({ data: assignments });
      }
      await transaction.auditUnitPlanQuestion.deleteMany({ where: { planId } });
      if (questionIds.length) {
        await transaction.auditUnitPlanQuestion.createMany({
          data: questionIds.map((questionId) => ({ planId, questionId })),
        });
      }
    });

    const saved = await this.detail(programId, planId);
    const status = !saved.included
      ? "EXCLUDED"
      : this.ready(saved)
        ? "READY"
        : "DRAFT";
    const after = await this.prisma.auditUnitPlan.update({
      where: { id: planId },
      data: { status },
    });
    await this.app.log(
      user.id,
      user.username,
      "AUDIT_UNIT_DEADLINE_PLAN_SAVED",
      "AuditUnitPlan",
      planId,
      null,
      after,
      before,
    );
    return { ...after, ready: status === "READY" };
  }

  @Post(":planId/workspace")
  async createWorkspace(
    @Param("programId") programId: string,
    @Param("planId") planId: string,
    @CurrentUser() user: any,
  ) {
    const plan = await this.detail(programId, planId);
    if (!plan.included) {
      throw new BadRequestException("Unit tidak dimasukkan sebagai target audit.");
    }
    if (plan.workspace) return plan.workspace;
    if (!this.ready(plan)) {
      throw new BadRequestException(
        "Rencana belum lengkap. Tetapkan instrumen, Ketua Auditor, Auditor, Verifikator, batas submit telaah, dan batas keputusan Verifikator.",
      );
    }
    const existing = await this.prisma.auditWorkspace.findUnique({
      where: {
        unitId_auditYear: {
          unitId: plan.unitId,
          auditYear: plan.program.auditYear,
        },
      },
    });
    if (existing) {
      if (existing.programId !== programId) {
        throw new BadRequestException(
          "Unit sudah mempunyai ruang kerja pada tahun audit yang sama.",
        );
      }
      await this.prisma.auditUnitPlan.update({
        where: { id: planId },
        data: { workspaceId: existing.id, status: "WORKSPACE_CREATED" },
      });
      return existing;
    }

    const questions = [...plan.questions].sort((a, b) =>
      `${a.moduleCode}:${a.code}`.localeCompare(`${b.moduleCode}:${b.code}`),
    );
    const workspace = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.auditWorkspace.create({
        data: {
          unitId: plan.unitId,
          auditYear: plan.program.auditYear,
          programId,
          name: `${plan.unit.slug}_${plan.program.auditYear}`,
          status: "INSTRUMENT_REVIEW",
          instrumentStatus: "AUDITOR_REVIEW",
          team: {
            create: plan.assignments.map((assignment) => ({
              userId: assignment.userId,
              role: assignment.role,
            })),
          },
          questions: {
            create: questions.map((question, index) => ({
              masterQuestionId: question.id,
              dimension: question.dimension,
              questionSnapshot: question.question,
              defaultQuestion: question.question,
              moduleCode: question.moduleCode,
              defaultExpectedEvidence: question.expectedEvidence,
              defaultTestMethod: question.testMethod,
              defaultRiskLevel: question.riskLevel,
              required: question.required,
              weight: question.weight,
              defaultWeight: question.weight,
              sortOrder: index + 1,
              reviewStatus: "AUDITOR_REVIEW",
            })),
          },
        },
      });
      await transaction.auditUnitPlan.update({
        where: { id: planId },
        data: { workspaceId: created.id, status: "WORKSPACE_CREATED" },
      });
      return created;
    });
    await this.app.log(
      user.id,
      user.username,
      "AUDIT_WORKSPACE_CREATED_FROM_DEADLINE_PLAN",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      { programId, planId, unitId: plan.unitId, instrumentCount: questions.length },
    );
    return workspace;
  }
}
