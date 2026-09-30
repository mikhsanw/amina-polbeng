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
exports.ReportRegistrationController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
let ReportRegistrationController = class ReportRegistrationController {
    flow;
    constructor(flow) {
        this.flow = flow;
    }
    async register(id, body, user) {
        const workspace = await this.flow.workspace(id, user);
        const type = String(body.type || "AUDIT_REPORT").trim().toUpperCase();
        const latest = await this.flow.prisma.printDocument.aggregate({
            where: { workspaceId: id, type },
            _max: { version: true },
        });
        const version = (latest._max.version || 0) + 1;
        const fileName = `${type}_${workspace.unit.slug}_${workspace.auditYear}_v${version}.pdf`;
        const record = await this.flow.prisma.printDocument.create({
            data: {
                workspaceId: id,
                type,
                fileName,
                version,
                storageKey: `dynamic://audit-report/${id}/${version}`,
                status: "READY",
            },
        });
        await this.flow.log(user.id, user.username, "AUDIT_REPORT_VERSION_CREATED", "PrintDocument", record.id, id, { type, version, fileName });
        return record;
    }
    async remove(id, user) {
        const record = await this.flow.prisma.printDocument.findUnique({
            where: { id },
        });
        if (!record)
            throw new common_1.NotFoundException("Versi laporan tidak ditemukan.");
        await this.flow.workspace(record.workspaceId, user);
        await this.flow.prisma.printDocument.delete({ where: { id } });
        await this.flow.log(user.id, user.username, "AUDIT_REPORT_VERSION_DELETED", "PrintDocument", id, record.workspaceId, {
            type: record.type,
            version: record.version,
            fileName: record.fileName,
            permanentlyDeleted: true,
        });
        return { ok: true, deletedId: id };
    }
};
exports.ReportRegistrationController = ReportRegistrationController;
__decorate([
    (0, common_1.Post)("workspaces/:id/print"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportRegistrationController.prototype, "register", null);
__decorate([
    (0, common_1.Delete)("print-documents/:id"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReportRegistrationController.prototype, "remove", null);
exports.ReportRegistrationController = ReportRegistrationController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService])
], ReportRegistrationController);
//# sourceMappingURL=report-registration.controller.js.map