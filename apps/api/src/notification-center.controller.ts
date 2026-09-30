import { Controller, ForbiddenException, Get, Param, Patch } from "@nestjs/common";
import { CurrentUser } from "./auth";
import { PrismaService } from "./prisma.service";

@Controller("notification-center")
export class NotificationCenterController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    const reviewWorkspaces = await this.prisma.auditWorkspace.findMany({
      where: {
        instrumentStatus: { in: ["AUDITOR_REVIEW", "RETURNED"] },
        team: {
          some: {
            userId: user.id,
            role: { in: ["AUDITOR", "LEAD_AUDITOR"] },
          },
        },
      },
      include: { unit: true },
    });

    if (reviewWorkspaces.length) {
      const existing = await this.prisma.notification.findMany({
        where: {
          recipientUserId: user.id,
          event: "INSTRUMENT_REVIEW_REQUESTED",
          workspaceId: { in: reviewWorkspaces.map((item) => item.id) },
        },
        select: { workspaceId: true },
      });
      const existingIds = new Set(existing.map((item) => item.workspaceId));
      const missing = reviewWorkspaces.filter((item) => !existingIds.has(item.id));
      if (missing.length) {
        await this.prisma.notification.createMany({
          data: missing.map((workspace) => ({
            workspaceId: workspace.id,
            recipientUserId: user.id,
            event: "INSTRUMENT_REVIEW_REQUESTED",
            title: `Telaah instrumen ${workspace.unit.name}`,
            message:
              workspace.instrumentStatus === "RETURNED"
                ? "Instrumen dikembalikan Verifikator dan perlu ditelaah kembali."
                : "Anda ditugaskan menelaah instrumen pada unit audit ini.",
            entityType: "AuditWorkspace",
            entityId: workspace.id,
          })),
        });
      }
    }

    return this.prisma.notification.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: any) {
    return this.prisma.notification.updateMany({
      where: { recipientUserId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  @Patch(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: any) {
    const item = await this.prisma.notification.findFirst({
      where: { id, recipientUserId: user.id },
    });
    if (!item) {
      throw new ForbiddenException("Notifikasi tidak ditemukan untuk pengguna ini.");
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: item.readAt ?? new Date() },
    });
  }
}
