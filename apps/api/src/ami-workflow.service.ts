import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";

@Injectable()
export class AmiWorkflowService {
  constructor(
    readonly prisma: PrismaService,
    private readonly app: AppService,
  ) {}

  isGlobal(user: any) {
    return user.roleCodes.some((role: string) =>
      ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"].includes(role),
    );
  }

  hasRole(user: any, roles: string[]) {
    return user.roleCodes.some((role: string) => roles.includes(role));
  }

  requireStatus(status: string, allowed: string[]) {
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Data terkunci pada status ${status}. Tahap yang diperbolehkan: ${allowed.join(", ")}.`,
      );
    }
  }

  async workspace(id: string, user: any) {
    const workspace = await this.prisma.auditWorkspace.findUniqueOrThrow({
      where: { id },
      include: {
        unit: true,
        program: true,
        team: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                unitId: true,
                isUnitApprover: true,
                unit: { select: { code: true, name: true } },
                roles: { include: { role: true } },
              },
            },
          },
        },
        _count: {
          select: { questions: true, evidences: true, findings: true, actions: true },
        },
      },
    });
    if (
      !this.isGlobal(user) &&
      workspace.unitId !== user.unitId &&
      !workspace.team.some((member) => member.userId === user.id)
    ) {
      throw new ForbiddenException("Anda tidak ditugaskan pada audit ini.");
    }
    return workspace;
  }

  requireAssignment(workspace: any, user: any, roles: string[]) {
    if (
      !workspace.team.some(
        (member: any) => member.userId === user.id && roles.includes(member.role),
      )
    ) {
      throw new ForbiddenException(
        "Pengguna tidak mempunyai penugasan yang sesuai pada workspace ini.",
      );
    }
  }

  questionDefault(question: any) {
    return {
      question: question.defaultQuestion ?? question.questionSnapshot,
      expectedEvidence: question.defaultExpectedEvidence,
      testMethod: question.defaultTestMethod,
      riskLevel: question.defaultRiskLevel,
      excluded: false,
    };
  }

  questionProposal(question: any) {
    return {
      question: question.auditorQuestion ?? question.defaultQuestion,
      expectedEvidence:
        question.auditorExpectedEvidence ?? question.defaultExpectedEvidence,
      testMethod: question.auditorTestMethod ?? question.defaultTestMethod,
      riskLevel: question.auditorRiskLevel ?? question.defaultRiskLevel,
      excluded: question.excluded,
      exclusionReason: question.exclusionReason,
    };
  }

  async notifyRole(
    workspaceId: string,
    assignmentRole: string,
    event: any,
    title: string,
    message: string,
    entityType: string,
    entityId: string,
  ) {
    const recipients = await this.prisma.auditTeam.findMany({
      where: { workspaceId, role: assignmentRole },
      select: { userId: true },
    });
    if (!recipients.length) return;
    await this.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        workspaceId,
        recipientUserId: recipient.userId,
        event,
        title,
        message,
        entityType,
        entityId,
      })),
    });
  }

  async publishInstrument(workspaceId: string, user: any, note?: string) {
    const questions = await this.prisma.auditQuestion.findMany({
      where: { workspaceId },
    });
    if (!questions.length) {
      throw new BadRequestException("Instrumen belum dibentuk.");
    }
    await this.prisma.$transaction([
      ...questions.map((question) =>
        this.prisma.auditQuestion.update({
          where: { id: question.id },
          data: {
            publishedQuestion:
              question.auditorQuestion ?? question.defaultQuestion,
            publishedExpectedEvidence:
              question.auditorExpectedEvidence ?? question.defaultExpectedEvidence,
            publishedTestMethod:
              question.auditorTestMethod ?? question.defaultTestMethod,
            publishedRiskLevel:
              question.auditorRiskLevel ?? question.defaultRiskLevel,
            questionSnapshot:
              question.auditorQuestion ?? question.defaultQuestion,
            reviewStatus: "PUBLISHED",
            approvedById: user.id,
            approvedAt: new Date(),
          },
        }),
      ),
      ...questions
        .filter((question) => !question.excluded)
        .map((question) =>
          this.prisma.selfAssessment.upsert({
            where: { auditQuestionId: question.id },
            create: {
              auditQuestionId: question.id,
              responseStatus: "NOT_STARTED",
            },
            update: {},
          }),
        ),
      this.prisma.auditWorkspace.update({
        where: { id: workspaceId },
        data: {
          instrumentStatus: "PUBLISHED",
          status: "SELF_ASSESSMENT",
        },
      }),
    ]);
    await this.app.log(
      user.id,
      user.username,
      "INSTRUMENT_PUBLISHED",
      "AuditWorkspace",
      workspaceId,
      workspaceId,
      { note, count: questions.filter((question) => !question.excluded).length },
    );
    return { ok: true, count: questions.length };
  }

  log(...args: Parameters<AppService["log"]>) {
    return this.app.log(...args);
  }
}
