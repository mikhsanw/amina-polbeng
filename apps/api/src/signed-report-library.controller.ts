import { Controller, Get } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CurrentUser } from "./auth";
import { AmiWorkflowService } from "./ami-workflow.service";
import { SIGNED_ARCHIVE_MARKER } from "./audit-archive.controller";

async function listSignedReports(flow: AmiWorkflowService, user: any) {
  const where: Prisma.EvidenceWhereInput = {
    auditQuestionId: null,
    description: SIGNED_ARCHIVE_MARKER,
    deletedAt: null,
  };

  if (!flow.isGlobal(user)) {
    where.workspace = {
      is: {
        OR: [
          { unitId: user.unitId ?? "__NONE__" },
          { team: { some: { userId: user.id } } },
        ],
      },
    };
  }

  return flow.prisma.evidence.findMany({
    where,
    include: {
      workspace: {
        include: {
          unit: { select: { id: true, code: true, name: true } },
          program: { select: { id: true, code: true, name: true } },
        },
      },
      uploadedBy: { select: { id: true, fullName: true, username: true } },
    },
    orderBy: [{ uploadedAt: "desc" }, { title: "asc" }],
  });
}

@Controller("report-library")
export class SignedReportLibraryController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Get("signed")
  list(@CurrentUser() user: any) {
    return listSignedReports(this.flow, user);
  }
}

/**
 * Endpoint kompatibilitas untuk bundle frontend lama yang masih meminta
 * /audit-flow/signed-reports. Controller ini harus didaftarkan sebelum route
 * generik /audit-flow/:id agar kata signed-reports tidak dibaca sebagai ID
 * workspace.
 */
@Controller("audit-flow")
export class SignedReportCompatibilityController {
  constructor(private readonly flow: AmiWorkflowService) {}

  @Get("signed-reports")
  list(@CurrentUser() user: any) {
    return listSignedReports(this.flow, user);
  }
}
