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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignedReportCompatibilityController = exports.SignedReportLibraryController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_archive_controller_1 = require("./audit-archive.controller");
async function listSignedReports(flow, user) {
    const where = {
        auditQuestionId: null,
        description: audit_archive_controller_1.SIGNED_ARCHIVE_MARKER,
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
let SignedReportLibraryController = class SignedReportLibraryController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    list(user) {
        return listSignedReports(this.flow, user);
    }
};
exports.SignedReportLibraryController = SignedReportLibraryController;
__decorate([
    (0, common_1.Get)("signed"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SignedReportLibraryController.prototype, "list", null);
exports.SignedReportLibraryController = SignedReportLibraryController = __decorate([
    (0, common_1.Controller)("report-library"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], SignedReportLibraryController);
let SignedReportCompatibilityController = class SignedReportCompatibilityController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    list(user) {
        return listSignedReports(this.flow, user);
    }
};
exports.SignedReportCompatibilityController = SignedReportCompatibilityController;
__decorate([
    (0, common_1.Get)("signed-reports"),
    __param(0, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SignedReportCompatibilityController.prototype, "list", null);
exports.SignedReportCompatibilityController = SignedReportCompatibilityController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], SignedReportCompatibilityController);
//# sourceMappingURL=signed-report-library.controller.js.map