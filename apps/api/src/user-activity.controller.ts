import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "./auth";
import { PrismaService } from "./prisma.service";

function yearBounds(value?: string) {
  const year = Number(value) || new Date().getFullYear();
  return {
    year,
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function category(action: string) {
  if (action.includes("INSTRUMENT")) return "instrument";
  if (
    action.includes("SELF_ASSESSMENT") ||
    action.includes("ASSESSMENT_EVIDENCE") ||
    action.includes("EVIDENCE_")
  ) {
    return "selfAssessment";
  }
  if (action.includes("FIELD_")) return "fieldAudit";
  if (
    action.includes("WORKPAPER") ||
    action.includes("FINDING") ||
    action.includes("CORRECTIVE") ||
    action.includes("ACTION_") ||
    action.includes("VERIFICATION")
  ) {
    return "followUp";
  }
  return "other";
}

@Controller("activity-evaluation")
@Roles("SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN")
export class UserActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query("year") yearValue?: string) {
    const { year, start, end } = yearBounds(yearValue);
    const [users, logs, assignments, systemFallbacks] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
          unit: { select: { code: true, name: true } },
          roles: { include: { role: true } },
        },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.activityLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: start, lt: end },
        },
        select: {
          userId: true,
          action: true,
          result: true,
          workspaceId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.auditTeam.findMany({
        where: { workspace: { auditYear: year } },
        select: {
          userId: true,
          role: true,
          workspaceId: true,
          workspace: {
            select: { unit: { select: { code: true, name: true } } },
          },
        },
      }),
      this.prisma.activityLog.findMany({
        where: {
          username: "SYSTEM",
          createdAt: { gte: start, lt: end },
          action: {
            in: [
              "AUTO_INSTRUMENT_REVIEW_CLOSED",
              "AUTO_INSTRUMENT_VERIFICATION_CLOSED",
            ],
          },
        },
        select: { workspaceId: true, action: true, createdAt: true },
      }),
    ]);

    const logsByUser = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!log.userId) continue;
      const rows = logsByUser.get(log.userId) || [];
      rows.push(log);
      logsByUser.set(log.userId, rows);
    }

    const assignmentsByUser = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const rows = assignmentsByUser.get(assignment.userId) || [];
      rows.push(assignment);
      assignmentsByUser.set(assignment.userId, rows);
    }

    const missedByUser = new Map<string, number>();
    for (const fallback of systemFallbacks) {
      if (!fallback.workspaceId) continue;
      const affectedRoles =
        fallback.action === "AUTO_INSTRUMENT_REVIEW_CLOSED"
          ? ["AUDITOR", "LEAD_AUDITOR"]
          : ["VERIFIER"];
      for (const assignment of assignments.filter(
        (item) =>
          item.workspaceId === fallback.workspaceId &&
          affectedRoles.includes(item.role),
      )) {
        missedByUser.set(
          assignment.userId,
          (missedByUser.get(assignment.userId) || 0) + 1,
        );
      }
    }

    const rows = users.map((user) => {
      const userLogs = logsByUser.get(user.id) || [];
      const userAssignments = assignmentsByUser.get(user.id) || [];
      const counts = {
        instrument: 0,
        selfAssessment: 0,
        fieldAudit: 0,
        followUp: 0,
        other: 0,
      };
      for (const log of userLogs) counts[category(log.action)] += 1;
      const missedDeadlines = missedByUser.get(user.id) || 0;
      const lastActivity = userLogs.at(-1)?.createdAt ?? null;
      const actionCount = userLogs.length;
      const activityStatus = missedDeadlines
        ? "PERLU_PERHATIAN"
        : actionCount >= 20
          ? "SANGAT_AKTIF"
          : actionCount >= 8
            ? "AKTIF"
            : actionCount > 0
              ? "TERBATAS"
              : userAssignments.length
                ? "BELUM_AKTIF"
                : "TIDAK_DITUGASKAN";
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        accountStatus: user.status,
        unit: user.unit,
        roles: user.roles.map((item) => item.role.code),
        assignedWorkspaces: new Set(
          userAssignments.map((item) => item.workspaceId),
        ).size,
        assignmentRoles: [...new Set(userAssignments.map((item) => item.role))],
        assignedUnits: [
          ...new Set(
            userAssignments.map(
              (item) =>
                `${item.workspace.unit.code} · ${item.workspace.unit.name}`,
            ),
          ),
        ],
        actionCount,
        actionCounts: counts,
        lastActivity,
        missedDeadlines,
        activityStatus,
      };
    });

    return {
      year,
      generatedAt: new Date(),
      rows,
      summary: {
        users: rows.length,
        assignedUsers: rows.filter((row) => row.assignedWorkspaces > 0).length,
        activeUsers: rows.filter((row) => row.actionCount > 0).length,
        usersWithMissedDeadlines: rows.filter((row) => row.missedDeadlines > 0)
          .length,
      },
    };
  }
}
