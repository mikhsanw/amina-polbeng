import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { CurrentUser, Roles } from "./auth";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";

const REQUIRED_PHASES = [
  ["instrumentReviewStart", "instrumentReviewEnd"],
  ["instrumentVerificationStart", "instrumentVerificationEnd"],
  ["selfAssessmentStart", "selfAssessmentEnd"],
  ["selfAssessmentReviewStart", "selfAssessmentReviewEnd"],
  ["fieldAuditStart", "fieldAuditEnd"],
] as const;

const ALL_PHASES = [
  ...REQUIRED_PHASES,
  ["reportingStart", "reportingEnd"],
  ["followUpStart", "followUpEnd"],
] as const;

type PhaseKey = (typeof ALL_PHASES)[number][number];
type ScheduleData = Record<PhaseKey, Date | null>;

function optionalDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Tanggal ${String(value)} tidak valid.`);
  }
  return date;
}

function roleCodes(user: any): string[] {
  return (user.roles || []).map((item: any) => String(item.role.code));
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .map((item: unknown) => String(item).trim())
    .filter((item: string) => item.length > 0);
  return [...new Set<string>(rows)];
}

@Controller("audit-programs/:programId/unit-plans")
@Roles("SUPER_ADMIN", "ADMIN_MUTU")
export class AnnualAuditPlanningController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
  ) {}

  private async ensurePlans(programId: string) {
    const [program, units, existingPlans] = await Promise.all([
      this.prisma.auditProgram.findUniqueOrThrow({ where: { id: programId } }),
      this.prisma.unit.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.auditUnitPlan.findMany({
        where: { programId },
        select: { unitId: true },
      }),
    ]);

    const existingUnitIds = new Set(
      existingPlans.map((item) => item.unitId),
    );
    for (const unit of units) {
      if (existingUnitIds.has(unit.id)) continue;
      const defaults = await this.prisma.masterQuestion.findMany({
        where: {
          active: true,
          unitMaps: { some: { unitId: unit.id } },
        },
        select: { id: true },
      });
      const plan = await this.prisma.auditUnitPlan.create({
        data: { programId, unitId: unit.id },
      });
      if (defaults.length) {
        await this.prisma.auditUnitPlanQuestion.createMany({
          data: defaults.map((question) => ({
            planId: plan.id,
            questionId: question.id,
          })),
        });
      }
    }
    return program;
  }

  private scheduleData(body: any): ScheduleData {
    const schedule = {} as ScheduleData;
    for (const [startKey, endKey] of ALL_PHASES) {
      schedule[startKey] = optionalDate(body[startKey]);
      schedule[endKey] = optionalDate(body[endKey]);
      const start = schedule[startKey];
      const end = schedule[endKey];
      if (start && end && end.getTime() < start.getTime()) {
        throw new BadRequestException(
          "Tanggal selesai tahapan tidak boleh lebih awal dari tanggal mulai.",
        );
      }
    }
    return schedule;
  }

  private validateScheduleBounds(
    schedule: ScheduleData,
    program: { startDate: Date; endDate: Date },
  ) {
    for (const value of Object.values(schedule)) {
      if (
        value &&
        (value.getTime() < program.startDate.getTime() ||
          value.getTime() > program.endDate.getTime())
      ) {
        throw new BadRequestException(
          "Seluruh jadwal tahapan harus berada di dalam rentang program audit.",
        );
      }
    }
    const sequence: Array<[Date | null, Date | null]> = [
      [schedule.instrumentReviewEnd, schedule.instrumentVerificationStart],
      [schedule.instrumentVerificationEnd, schedule.selfAssessmentStart],
      [schedule.selfAssessmentEnd, schedule.selfAssessmentReviewStart],
      [schedule.selfAssessmentReviewEnd, schedule.fieldAuditStart],
      [schedule.fieldAuditEnd, schedule.reportingStart],
      [schedule.reportingEnd, schedule.followUpStart],
    ];
    for (const [previousEnd, nextStart] of sequence) {
      if (
        previousEnd &&
        nextStart &&
        nextStart.getTime() < previousEnd.getTime()
      ) {
        throw new BadRequestException(
          "Urutan jadwal tahapan audit tidak boleh saling mendahului.",
        );
      }
    }
  }

  private isReady(plan: any): boolean {
    if (!plan.included || plan.workspaceId) return false;
    const assignments = plan.assignments || [];
    const hasLead = assignments.some(
      (item: any) => item.role === "LEAD_AUDITOR",
    );
    const hasAuditor = assignments.some(
      (item: any) => item.role === "AUDITOR",
    );
    const hasVerifier = assignments.some(
      (item: any) => item.role === "VERIFIER",
    );
    const scheduleComplete = REQUIRED_PHASES.every(
      ([startKey, endKey]) => Boolean(plan[startKey] && plan[endKey]),
    );
    return (
      Number(plan.questionCount || 0) > 0 &&
      hasLead &&
      hasAuditor &&
      hasVerifier &&
      scheduleComplete
    );
  }

  private async getPlan(programId: string, planId: string) {
    const base = await this.prisma.auditUnitPlan.findUniqueOrThrow({
      where: { id: planId },
    });
    if (base.programId !== programId) {
      throw new BadRequestException("Rencana unit tidak berasal dari program ini.");
    }

    const [program, unit, assignments, questionLinks, workspace] =
      await Promise.all([
        this.prisma.auditProgram.findUniqueOrThrow({
          where: { id: base.programId },
        }),
        this.prisma.unit.findUniqueOrThrow({ where: { id: base.unitId } }),
        this.prisma.auditUnitPlanAssignment.findMany({
          where: { planId },
          orderBy: { role: "asc" },
        }),
        this.prisma.auditUnitPlanQuestion.findMany({ where: { planId } }),
        base.workspaceId
          ? this.prisma.auditWorkspace.findUnique({
              where: { id: base.workspaceId },
            })
          : null,
      ]);

    const userIds = assignments.map((item) => item.userId);
    const questionIds = questionLinks.map((item) => item.questionId);
    const [users, questions] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            include: { roles: { include: { role: true } } },
          })
        : [],
      questionIds.length
        ? this.prisma.masterQuestion.findMany({
            where: { id: { in: questionIds } },
          })
        : [],
    ]);
    const usersById = new Map(users.map((item) => [item.id, item]));
    const questionsById = new Map(questions.map((item) => [item.id, item]));

    return {
      ...base,
      program,
      unit,
      workspace,
      assignments: assignments.map((item) => ({
        ...item,
        user: usersById.get(item.userId),
      })),
      questions: questionLinks
        .map((item) => questionsById.get(item.questionId))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      questionCount: questionLinks.length,
    };
  }

  @Get("matrix")
  async matrix(@Param("programId") programId: string) {
    const program = await this.ensurePlans(programId);
    const planRows = await this.prisma.auditUnitPlan.findMany({
      where: { programId },
      orderBy: { createdAt: "asc" },
    });
    const planIds = planRows.map((item) => item.id);
    const unitIds = planRows.map((item) => item.unitId);
    const workspaceIds = planRows
      .map((item) => item.workspaceId)
      .filter((item): item is string => Boolean(item));

    const [units, assignments, questionLinks, workspaces, users, defaultMaps] =
      await Promise.all([
        this.prisma.unit.findMany({ where: { id: { in: unitIds } } }),
        planIds.length
          ? this.prisma.auditUnitPlanAssignment.findMany({
              where: { planId: { in: planIds } },
              orderBy: { role: "asc" },
            })
          : [],
        planIds.length
          ? this.prisma.auditUnitPlanQuestion.findMany({
              where: { planId: { in: planIds } },
            })
          : [],
        workspaceIds.length
          ? this.prisma.auditWorkspace.findMany({
              where: { id: { in: workspaceIds } },
              select: { id: true, status: true },
            })
          : [],
        this.prisma.user.findMany({
          where: {
            status: "ACTIVE",
            deletedAt: null,
            roles: {
              some: {
                role: {
                  code: {
                    in: ["AUDITOR", "KETUA_AUDITOR", "VERIFIKATOR"],
                  },
                },
              },
            },
          },
          select: {
            id: true,
            username: true,
            fullName: true,
            unitId: true,
            roles: { include: { role: true } },
          },
          orderBy: { fullName: "asc" },
        }),
        this.prisma.questionUnitMap.findMany({
          where: { question: { active: true } },
          select: { unitId: true },
        }),
      ]);

    const assignedUserIds = [
      ...new Set<string>(assignments.map((item) => item.userId)),
    ];
    const assignedUsers = assignedUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assignedUserIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const unitsById = new Map(units.map((item) => [item.id, item]));
    const workspacesById = new Map(workspaces.map((item) => [item.id, item]));
    const assignedUsersById = new Map(
      assignedUsers.map((item) => [item.id, item]),
    );
    const assignmentsByPlan = new Map<string, any[]>();
    for (const item of assignments) {
      const rows = assignmentsByPlan.get(item.planId) || [];
      rows.push({ ...item, user: assignedUsersById.get(item.userId) });
      assignmentsByPlan.set(item.planId, rows);
    }
    const questionCount = new Map<string, number>();
    for (const item of questionLinks) {
      questionCount.set(item.planId, (questionCount.get(item.planId) || 0) + 1);
    }
    const defaultCount = new Map<string, number>();
    for (const item of defaultMaps) {
      defaultCount.set(item.unitId, (defaultCount.get(item.unitId) || 0) + 1);
    }

    const candidates = users.map((user) => ({
      ...user,
      roles: roleCodes(user),
    }));
    const plans = planRows
      .map((row) => {
        const plan = {
          ...row,
          unit: unitsById.get(row.unitId),
          workspace: row.workspaceId
            ? workspacesById.get(row.workspaceId)
            : null,
          assignments: assignmentsByPlan.get(row.id) || [],
          _count: { questions: questionCount.get(row.id) || 0 },
          questionCount: questionCount.get(row.id) || 0,
          defaultInstrumentCount: defaultCount.get(row.unitId) || 0,
        };
        return { ...plan, ready: this.isReady(plan) };
      })
      .sort((a, b) =>
        (a.unit?.name || "").localeCompare(b.unit?.name || ""),
      );

    return { program, candidates, plans };
  }

  @Get(":planId/instruments")
  async instruments(
    @Param("programId") programId: string,
    @Param("planId") planId: string,
  ) {
    const plan = await this.getPlan(programId, planId);
    const available = await this.prisma.masterQuestion.findMany({
      where: { active: true },
      include: {
        standard: true,
        isoClause: true,
        unitMaps: {
          where: { unitId: plan.unitId },
          select: { unitId: true },
        },
      },
      orderBy: [{ moduleCode: "asc" }, { code: "asc" }],
    });
    return {
      selectedQuestionIds: plan.questions.map((item) => item.id),
      questions: available.map((question) => ({
        ...question,
        mappedToUnit: question.unitMaps.length > 0,
      })),
    };
  }

  @Put(":planId")
  async savePlan(
    @Param("programId") programId: string,
    @Param("planId") planId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const before = await this.getPlan(programId, planId);
    if (before.workspaceId) {
      throw new BadRequestException(
        "Ruang kerja sudah dibentuk. Perencanaan unit tidak dapat diubah lagi.",
      );
    }

    const included = body.included !== false;
    const schedule = this.scheduleData(body);
    this.validateScheduleBounds(schedule, before.program);
    const leadAuditorId = String(body.leadAuditorId || "").trim() || null;
    const verifierId = String(body.verifierId || "").trim() || null;
    const auditorIds: string[] = uniqueStrings(body.auditorIds);
    const allAssignmentIds: string[] = [
      leadAuditorId,
      verifierId,
      ...auditorIds,
    ].filter((item): item is string => Boolean(item));

    if (new Set(allAssignmentIds).size !== allAssignmentIds.length) {
      throw new BadRequestException(
        "Satu pengguna tidak boleh memegang lebih dari satu peran pada unit audit yang sama.",
      );
    }

    const assignmentUsers = allAssignmentIds.length
      ? await this.prisma.user.findMany({
          where: {
            id: { in: allAssignmentIds },
            status: "ACTIVE",
            deletedAt: null,
          },
          include: { roles: { include: { role: true } } },
        })
      : [];
    if (assignmentUsers.length !== allAssignmentIds.length) {
      throw new BadRequestException(
        "Salah satu personel tidak aktif atau tidak ditemukan.",
      );
    }

    const usersById = new Map(assignmentUsers.map((item) => [item.id, item]));
    const validateUser = (
      id: string | null,
      allowedRoles: string[],
      label: string,
    ) => {
      if (!id) return;
      const selected = usersById.get(id);
      if (!selected) {
        throw new BadRequestException(`${label} tidak ditemukan.`);
      }
      if (!allowedRoles.some((role) => roleCodes(selected).includes(role))) {
        throw new BadRequestException(`${label} tidak memiliki role yang sesuai.`);
      }
      if (selected.unitId === before.unitId) {
        throw new BadRequestException(
          `${label} berasal dari unit auditee dan menimbulkan konflik kepentingan.`,
        );
      }
    };

    validateUser(leadAuditorId, ["KETUA_AUDITOR"], "Ketua Auditor");
    for (const auditorId of auditorIds) {
      validateUser(auditorId, ["AUDITOR", "KETUA_AUDITOR"], "Auditor");
    }
    validateUser(verifierId, ["VERIFIKATOR"], "Verifikator");

    const questionIds: string[] = uniqueStrings(body.questionIds);
    if (questionIds.length) {
      const activeCount = await this.prisma.masterQuestion.count({
        where: { id: { in: questionIds }, active: true },
      });
      if (activeCount !== questionIds.length) {
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
          ...schedule,
        },
      });
      await transaction.auditUnitPlanAssignment.deleteMany({
        where: { planId },
      });

      const assignments: Array<{
        planId: string;
        userId: string;
        role: string;
      }> = [
        ...(leadAuditorId
          ? [{ planId, userId: leadAuditorId, role: "LEAD_AUDITOR" }]
          : []),
        ...auditorIds.map((userId) => ({ planId, userId, role: "AUDITOR" })),
        ...(verifierId
          ? [{ planId, userId: verifierId, role: "VERIFIER" }]
          : []),
      ];
      if (assignments.length) {
        await transaction.auditUnitPlanAssignment.createMany({
          data: assignments,
        });
      }

      if (Array.isArray(body.questionIds)) {
        await transaction.auditUnitPlanQuestion.deleteMany({
          where: { planId },
        });
        if (questionIds.length) {
          await transaction.auditUnitPlanQuestion.createMany({
            data: questionIds.map((questionId) => ({ planId, questionId })),
          });
        }
      }
    });

    const saved = await this.getPlan(programId, planId);
    const status = !saved.included
      ? "EXCLUDED"
      : this.isReady(saved)
        ? "READY"
        : "DRAFT";
    const after = await this.prisma.auditUnitPlan.update({
      where: { id: planId },
      data: { status },
    });
    await this.app.log(
      user.id,
      user.username,
      "AUDIT_UNIT_PLAN_SAVED",
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
    const plan = await this.getPlan(programId, planId);
    if (!plan.included) {
      throw new BadRequestException("Unit tidak dimasukkan sebagai target audit.");
    }
    if (plan.workspace) return plan.workspace;
    if (!this.isReady(plan)) {
      throw new BadRequestException(
        "Rencana unit belum lengkap. Tetapkan instrumen, Ketua Auditor, minimal satu Auditor, Verifikator, serta jadwal telaah instrumen, validasi Verifikator, self-assessment, pemeriksaan Auditor, dan audit lapangan.",
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
          "Unit ini sudah mempunyai ruang kerja pada tahun audit yang sama di program lain.",
        );
      }
      await this.prisma.auditUnitPlan.update({
        where: { id: planId },
        data: { workspaceId: existing.id, status: "WORKSPACE_CREATED" },
      });
      return existing;
    }

    const sortedQuestions = [...plan.questions].sort((a, b) =>
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
            create: sortedQuestions.map((question, index) => ({
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
      "AUDIT_WORKSPACE_CREATED_FROM_PLAN",
      "AuditWorkspace",
      workspace.id,
      workspace.id,
      {
        programId,
        planId,
        unitId: plan.unitId,
        instrumentCount: sortedQuestions.length,
      },
    );
    return workspace;
  }
}
