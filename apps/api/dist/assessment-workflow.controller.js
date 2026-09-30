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
exports.AssessmentWorkflowController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
const STANDARD_RESULTS = [
    "MELAMPAUI",
    "TERCAPAI",
    "TIDAK_TERCAPAI",
    "BELUM_DIKERJAKAN",
    "BELUM_DIUKUR",
];
const PROCESS_RESULTS = [
    "C",
    "OFI",
    "OBS",
    "KTS_MINOR",
    "KTS_MAYOR",
    "NC_MINOR",
    "NC_MAJOR",
    "GP",
    "NA",
];
let AssessmentWorkflowController = class AssessmentWorkflowController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    mapStandardResult(value) {
        const result = String(value ?? "").trim().toUpperCase();
        if (!STANDARD_RESULTS.includes(result)) {
            throw new common_1.BadRequestException("Hasil pencapaian standar tidak valid.");
        }
        return result === "BELUM_DIKERJAKAN" ? "BELUM_DIUKUR" : result;
    }
    mapProcessResult(value) {
        const result = String(value ?? "").trim().toUpperCase();
        if (!PROCESS_RESULTS.includes(result)) {
            throw new common_1.BadRequestException("Hasil kesesuaian proses tidak valid.");
        }
        if (result === "NC_MINOR")
            return "KTS_MINOR";
        if (result === "NC_MAJOR")
            return "KTS_MAYOR";
        return result;
    }
    async detail(id, user) {
        const workspace = await this.flow.workspace(id, user);
        const [questions, evidences, schedule] = await Promise.all([
            this.flow.prisma.auditQuestion.findMany({
                where: {
                    workspaceId: id,
                    reviewStatus: "PUBLISHED",
                    excluded: false,
                },
                include: {
                    assessment: true,
                    masterQuestion: { include: { standard: true, isoClause: true } },
                    evidences: {
                        where: { deletedAt: null },
                        orderBy: { uploadedAt: "desc" },
                    },
                    findings: { orderBy: { createdAt: "desc" } },
                },
                orderBy: { sortOrder: "asc" },
            }),
            this.flow.prisma.evidence.findMany({
                where: { workspaceId: id, deletedAt: null },
                include: {
                    auditQuestion: { select: { id: true, sortOrder: true } },
                    uploadedBy: { select: { id: true, fullName: true } },
                },
                orderBy: { uploadedAt: "desc" },
            }),
            this.schedule.detail(id),
        ]);
        return { workspace, questions, evidences, schedule };
    }
    async saveAuditeeAnswer(id, body, user) {
        const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
            where: { id },
            include: { question: { include: { workspace: true } } },
        });
        const workspace = assessment.question.workspace;
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        if (workspace.status === "SELF_ASSESSMENT") {
            await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT");
            this.flow.requireStatus(assessment.responseStatus, [
                "NOT_STARTED",
                "IN_PROGRESS",
                "RETURNED",
            ]);
        }
        else if (workspace.status === "FIELD_AUDIT") {
            await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");
            this.flow.requireStatus(assessment.responseStatus, ["RETURNED", "OPEN"]);
        }
        else {
            throw new common_1.BadRequestException("Jawaban Auditee hanya dapat diperbarui pada tahap self-assessment atau perbaikan audit lapangan.");
        }
        const implementationDescription = String(body.implementationDescription ?? body.response ?? "").trim();
        const updated = await this.flow.prisma.selfAssessment.update({
            where: { id },
            data: {
                response: implementationDescription || null,
                implementationDescription: implementationDescription || null,
                evidenceSummary: String(body.evidenceSummary ?? "").trim() || null,
                constraintNote: String(body.constraintNote ?? "").trim() || null,
                responseStatus: "IN_PROGRESS",
                score: null,
                standardResult: null,
                processResult: null,
            },
        });
        await this.flow.log(user.id, user.username, "SELF_ASSESSMENT_ANSWER_SAVED", "SelfAssessment", id, workspace.id, { auditQuestionId: assessment.auditQuestionId });
        return updated;
    }
    async submitAuditee(id, user) {
        const workspace = await this.flow.workspace(id, user);
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(workspace.status, ["SELF_ASSESSMENT"]);
        await this.schedule.requireOpen(id, "SELF_ASSESSMENT");
        const incomplete = await this.flow.prisma.selfAssessment.count({
            where: {
                question: { workspaceId: id, required: true, excluded: false },
                OR: [
                    { implementationDescription: null },
                    { implementationDescription: "" },
                ],
            },
        });
        if (incomplete) {
            throw new common_1.BadRequestException(`Masih ada ${incomplete} pertanyaan wajib yang belum dijawab.`);
        }
        await this.flow.prisma.$transaction([
            this.flow.prisma.selfAssessment.updateMany({
                where: { question: { workspaceId: id, excluded: false } },
                data: {
                    responseStatus: "SUBMITTED",
                    submittedById: user.id,
                    submittedAt: new Date(),
                    approvedById: null,
                    approvedAt: null,
                    returnNote: null,
                },
            }),
            this.flow.prisma.auditWorkspace.update({
                where: { id },
                data: { status: "DESK_REVIEW" },
            }),
        ]);
        await this.flow.notifyRole(id, "AUDITOR", "SELF_ASSESSMENT_SUBMITTED", "Self-assessment menunggu pemeriksaan", `${workspace.unit.name} telah mengirim seluruh jawaban dan bukti untuk diperiksa.`, "AuditWorkspace", id);
        await this.flow.notifyRole(id, "LEAD_AUDITOR", "SELF_ASSESSMENT_SUBMITTED", "Self-assessment menunggu pemeriksaan", `${workspace.unit.name} telah mengirim seluruh jawaban dan bukti untuk diperiksa.`, "AuditWorkspace", id);
        await this.flow.log(user.id, user.username, "SELF_ASSESSMENT_SUBMITTED", "AuditWorkspace", id, id, { unitId: workspace.unitId });
        return { ok: true, status: "DESK_REVIEW" };
    }
    async reviewEvidence(id, body, user) {
        const evidence = await this.flow.prisma.evidence.findUniqueOrThrow({
            where: { id },
        });
        const workspace = await this.flow.workspace(evidence.workspaceId, user);
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
        await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT_REVIEW");
        const decision = String(body.decision ?? "").trim().toUpperCase();
        if (!["VALID", "INVALID"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih status bukti Valid atau Tidak Valid.");
        }
        const note = String(body.note ?? "").trim();
        if (decision === "INVALID" && !note) {
            throw new common_1.BadRequestException("Catatan wajib diisi untuk bukti yang tidak valid.");
        }
        const reviewStatus = decision === "VALID" ? "VALID" : "INVALID";
        const updated = await this.flow.prisma.evidence.update({
            where: { id },
            data: {
                reviewStatus,
                validationNote: note || null,
                validatedAt: new Date(),
            },
        });
        await this.flow.log(user.id, user.username, decision === "VALID" ? "EVIDENCE_VALIDATED" : "EVIDENCE_INVALIDATED", "Evidence", id, evidence.workspaceId, { decision, note: note || null });
        return updated;
    }
    async reviewAssessment(id, body, user) {
        const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
            where: { id },
            include: {
                question: {
                    include: {
                        workspace: { include: { team: true } },
                        evidences: { where: { deletedAt: null } },
                    },
                },
            },
        });
        const workspace = assessment.question.workspace;
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
        await this.schedule.requireOpen(workspace.id, "SELF_ASSESSMENT_REVIEW");
        this.flow.requireStatus(assessment.responseStatus, ["SUBMITTED"]);
        const pendingEvidence = assessment.question.evidences.filter((item) => item.reviewStatus === "PENDING").length;
        if (pendingEvidence) {
            throw new common_1.BadRequestException(`Masih ada ${pendingEvidence} bukti terkait yang belum diperiksa.`);
        }
        const decision = String(body.decision ?? "").trim().toUpperCase();
        if (!["ACCEPT", "RETURN"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih keputusan Diterima atau Dikembalikan.");
        }
        const note = String(body.note ?? "").trim();
        if (decision === "RETURN" && !note) {
            throw new common_1.BadRequestException("Catatan pengembalian wajib diisi.");
        }
        const accepted = decision === "ACCEPT";
        const updated = await this.flow.prisma.selfAssessment.update({
            where: { id },
            data: {
                responseStatus: accepted ? "APPROVED" : "RETURNED",
                approvedById: user.id,
                approvedAt: new Date(),
                returnNote: note || null,
            },
        });
        if (!accepted) {
            const auditees = await this.flow.prisma.user.findMany({
                where: {
                    unitId: workspace.unitId,
                    status: "ACTIVE",
                    roles: { some: { role: { code: "AUDITEE" } } },
                },
                select: { id: true },
            });
            if (auditees.length) {
                await this.flow.prisma.notification.createMany({
                    data: auditees.map((auditee) => ({
                        workspaceId: workspace.id,
                        recipientUserId: auditee.id,
                        event: "SELF_ASSESSMENT_RETURNED",
                        title: "Jawaban atau bukti perlu diperbaiki",
                        message: note,
                        entityType: "SelfAssessment",
                        entityId: id,
                    })),
                });
            }
        }
        await this.flow.log(user.id, user.username, accepted ? "SELF_ASSESSMENT_ITEM_ACCEPTED" : "SELF_ASSESSMENT_ITEM_RETURNED", "SelfAssessment", id, workspace.id, { decision, note: note || null });
        return updated;
    }
    async openFieldAudit(id, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["DESK_REVIEW"]);
        await this.schedule.requireOpen(id, "FIELD_AUDIT");
        const [unreviewedAssessments, pendingEvidence] = await Promise.all([
            this.flow.prisma.selfAssessment.count({
                where: {
                    question: { workspaceId: id, excluded: false },
                    responseStatus: { notIn: ["APPROVED", "RETURNED"] },
                },
            }),
            this.flow.prisma.evidence.count({
                where: { workspaceId: id, deletedAt: null, reviewStatus: "PENDING" },
            }),
        ]);
        if (unreviewedAssessments || pendingEvidence) {
            throw new common_1.BadRequestException(`Assessment lapangan belum dapat dibuka: ${unreviewedAssessments} jawaban dan ${pendingEvidence} bukti belum diperiksa.`);
        }
        const updated = await this.flow.prisma.auditWorkspace.update({
            where: { id },
            data: { status: "FIELD_AUDIT" },
        });
        await this.flow.log(user.id, user.username, "FIELD_AUDIT_OPENED", "AuditWorkspace", id, id, { unitId: workspace.unitId });
        return updated;
    }
    async fieldDecision(id, body, user) {
        const assessment = await this.flow.prisma.selfAssessment.findUniqueOrThrow({
            where: { id },
            include: {
                question: {
                    include: {
                        workspace: { include: { team: true } },
                        masterQuestion: { include: { standard: true, isoClause: true } },
                        findings: true,
                    },
                },
            },
        });
        const workspace = assessment.question.workspace;
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
        await this.schedule.requireOpen(workspace.id, "FIELD_AUDIT");
        const action = String(body.action ?? "").trim().toUpperCase();
        if (!["CLOSE", "OPEN"].includes(action)) {
            throw new common_1.BadRequestException("Pilih status Selesai atau Open.");
        }
        const result = assessment.question.dimension === "STANDARD_ACHIEVEMENT"
            ? this.mapStandardResult(body.standardResult)
            : this.mapProcessResult(body.processResult);
        const note = String(body.note ?? "").trim();
        if (!note) {
            throw new common_1.BadRequestException("Catatan hasil assessment lapangan wajib diisi.");
        }
        if (action === "CLOSE") {
            await this.flow.prisma.$transaction([
                this.flow.prisma.selfAssessment.update({
                    where: { id },
                    data: {
                        responseStatus: "APPROVED",
                        standardResult: assessment.question.dimension === "STANDARD_ACHIEVEMENT"
                            ? result
                            : null,
                        processResult: assessment.question.dimension === "PROCESS_CONFORMITY"
                            ? result
                            : null,
                        approvedById: user.id,
                        approvedAt: new Date(),
                        returnNote: note,
                        score: null,
                    },
                }),
                this.flow.prisma.finding.updateMany({
                    where: {
                        workspaceId: workspace.id,
                        auditQuestionId: assessment.auditQuestionId,
                        status: "OPEN",
                    },
                    data: { status: "CLOSED" },
                }),
            ]);
            await this.flow.log(user.id, user.username, "FIELD_ASSESSMENT_ITEM_CLOSED", "SelfAssessment", id, workspace.id, { result, note });
            return { ok: true, status: "APPROVED", result };
        }
        const dueDate = new Date(body.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
            throw new common_1.BadRequestException("Batas waktu perbaikan wajib diisi.");
        }
        const count = await this.flow.prisma.finding.count({
            where: { workspaceId: workspace.id },
        });
        const findingType = body.findingType === "NC_MINOR"
            ? "KTS_MINOR"
            : body.findingType === "NC_MAJOR"
                ? "KTS_MAYOR"
                : body.findingType || "KTS_MINOR";
        const existing = assessment.question.findings.find((item) => item.status === "OPEN");
        const findingData = {
            findingType: findingType,
            criteriaRegulation: body.criteriaRegulation ||
                assessment.question.masterQuestion.standard?.title ||
                "Standar internal",
            criteriaIso: body.criteriaIso ||
                assessment.question.masterQuestion.isoClause?.code ||
                "—",
            condition: body.condition || note,
            objectiveEvidence: body.objectiveEvidence || note,
            gapStatement: body.gapStatement || note,
            riskImpact: body.riskImpact || "Perlu perbaikan sesuai batas waktu.",
            dueDate,
            status: "OPEN",
        };
        await this.flow.prisma.$transaction([
            this.flow.prisma.selfAssessment.update({
                where: { id },
                data: {
                    responseStatus: "OPEN",
                    standardResult: assessment.question.dimension === "STANDARD_ACHIEVEMENT"
                        ? result
                        : null,
                    processResult: assessment.question.dimension === "PROCESS_CONFORMITY"
                        ? result
                        : null,
                    approvedById: user.id,
                    approvedAt: new Date(),
                    returnNote: note,
                    score: null,
                },
            }),
            existing
                ? this.flow.prisma.finding.update({
                    where: { id: existing.id },
                    data: findingData,
                })
                : this.flow.prisma.finding.create({
                    data: {
                        ...findingData,
                        code: `FND-${workspace.auditYear}-${String(count + 1).padStart(5, "0")}`,
                        workspaceId: workspace.id,
                        auditQuestionId: assessment.auditQuestionId,
                    },
                }),
        ]);
        await this.flow.log(user.id, user.username, "FIELD_ASSESSMENT_ITEM_OPENED", "SelfAssessment", id, workspace.id, { result, note, dueDate });
        return { ok: true, status: "OPEN", result, dueDate };
    }
    async completeFieldAudit(id, user) {
        const workspace = await this.flow.workspace(id, user);
        this.flow.requireAssignment(workspace, user, ["LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["FIELD_AUDIT"]);
        const unresolved = await this.flow.prisma.selfAssessment.count({
            where: {
                question: { workspaceId: id, excluded: false },
                responseStatus: { notIn: ["APPROVED", "OPEN"] },
            },
        });
        if (unresolved) {
            throw new common_1.BadRequestException(`Masih ada ${unresolved} butir yang belum diputuskan pada assessment lapangan.`);
        }
        const openQuestions = await this.flow.prisma.selfAssessment.count({
            where: { question: { workspaceId: id }, responseStatus: "OPEN" },
        });
        const updated = await this.flow.prisma.auditWorkspace.update({
            where: { id },
            data: { status: "REPORTING" },
        });
        await this.flow.log(user.id, user.username, "FIELD_AUDIT_COMPLETED", "AuditWorkspace", id, id, { openQuestions });
        return updated;
    }
    async uploadAssessmentEvidence(id, file, body, user) {
        if (!file)
            throw new common_1.BadRequestException("File bukti wajib dipilih.");
        const workspace = await this.flow.workspace(id, user);
        if (workspace.unitId !== user.unitId) {
            throw new common_1.BadRequestException("Bukan Auditee unit target.");
        }
        if (workspace.status === "SELF_ASSESSMENT") {
            await this.schedule.requireOpen(id, "SELF_ASSESSMENT");
        }
        else if (workspace.status === "FIELD_AUDIT") {
            await this.schedule.requireOpen(id, "FIELD_AUDIT");
            if (body.auditQuestionId) {
                const question = await this.flow.prisma.auditQuestion.findUniqueOrThrow({
                    where: { id: body.auditQuestionId },
                    include: { assessment: true },
                });
                if (question.workspaceId !== id ||
                    !["RETURNED", "OPEN", "IN_PROGRESS"].includes(question.assessment?.responseStatus || "")) {
                    throw new common_1.BadRequestException("Bukti perbaikan hanya dapat diunggah untuk butir yang dikembalikan atau berstatus Open.");
                }
            }
        }
        else {
            throw new common_1.BadRequestException("Unggah bukti tidak tersedia pada tahap audit saat ini.");
        }
        const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
        if (!file.buffer?.length || file.buffer.length > maxBytes) {
            throw new common_1.BadRequestException(`Ukuran file maksimal ${process.env.MAX_UPLOAD_MB ?? 20} MB.`);
        }
        const directory = (0, node_path_1.join)(process.cwd(), "storage", "audits", String(workspace.auditYear), workspace.name, "evidence");
        await (0, promises_1.mkdir)(directory, { recursive: true });
        const safeName = `${Date.now()}-${String(file.originalname).replace(/[^\w.-]/g, "_")}`;
        await (0, promises_1.writeFile)((0, node_path_1.join)(directory, safeName), file.buffer);
        const count = await this.flow.prisma.evidence.count();
        const evidence = await this.flow.prisma.evidence.create({
            data: {
                code: `EVD-${workspace.auditYear}-${String(count + 1).padStart(6, "0")}`,
                workspaceId: id,
                auditQuestionId: body.auditQuestionId || null,
                evidenceType: body.evidenceType || "OTHER",
                title: body.title || file.originalname,
                description: body.description || null,
                fileName: file.originalname,
                mimeType: file.mimetype || "application/octet-stream",
                fileSizeBytes: file.buffer.length,
                storageKey: (0, node_path_1.join)("storage", "audits", String(workspace.auditYear), workspace.name, "evidence", safeName),
                checksum: (0, node_crypto_1.createHash)("sha256").update(file.buffer).digest("hex"),
                uploadedById: user.id,
                confidentiality: body.confidentiality || "INTERNAL",
            },
        });
        await this.flow.log(user.id, user.username, "ASSESSMENT_EVIDENCE_UPLOADED", "Evidence", evidence.id, id, { auditQuestionId: body.auditQuestionId || null, fileName: file.originalname });
        return evidence;
    }
};
exports.AssessmentWorkflowController = AssessmentWorkflowController;
__decorate([
    (0, common_1.Get)("workspaces/:id/assessment-flow"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)("assessments/:id/auditee"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "saveAuditeeAnswer", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/assessments/submit-auditee"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "submitAuditee", null);
__decorate([
    (0, common_1.Patch)("assessment-evidences/:id/review"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "reviewEvidence", null);
__decorate([
    (0, common_1.Post)("assessments/:id/auditor-review"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "reviewAssessment", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/field-audit/open"),
    (0, auth_1.Roles)("KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "openFieldAudit", null);
__decorate([
    (0, common_1.Post)("assessments/:id/field-decision"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "fieldDecision", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/field-audit/complete"),
    (0, auth_1.Roles)("KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "completeFieldAudit", null);
__decorate([
    (0, common_1.Post)("workspaces/:id/assessment-evidences/upload"),
    (0, auth_1.Roles)("AUDITEE"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AssessmentWorkflowController.prototype, "uploadAssessmentEvidence", null);
exports.AssessmentWorkflowController = AssessmentWorkflowController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], AssessmentWorkflowController);
//# sourceMappingURL=assessment-workflow.controller.js.map