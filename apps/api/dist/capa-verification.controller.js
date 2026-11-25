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
exports.CapaVerificationController = exports.CAPA_EVIDENCE_MARKER = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const auth_1 = require("./auth");
const ami_workflow_service_1 = require("./ami-workflow.service");
const audit_schedule_service_1 = require("./audit-schedule.service");
exports.CAPA_EVIDENCE_MARKER = "CAPA_EVIDENCE:";
function text(value, label) {
    const result = String(value ?? "").trim();
    if (!result)
        throw new common_1.BadRequestException(`${label} wajib diisi.`);
    return result;
}
const CAPA_OPEN_WORKSPACE_STATUSES = ["FOLLOW_UP", "REPORT_REVIEW"];
const EDITABLE_FINDING_STATUSES = ["DRAFT", "REVIEW", "OPEN"];
const FINDING_TYPES = new Set(["OBS", "KTS_MINOR", "KTS_MAYOR"]);
function isIsoMaster(master) {
    return Boolean(master?.isoClauseId) || master?.criterionSource === "ISO_9001";
}
function capaPayload(body) {
    const targetDate = new Date(text(body.targetDate, "Target penyelesaian"));
    if (Number.isNaN(targetDate.getTime())) {
        throw new common_1.BadRequestException("Target penyelesaian tidak valid.");
    }
    return {
        correction: text(body.correction, "Koreksi langsung"),
        analysisMethod: text(body.analysisMethod || "FIVE_WHY", "Metode analisis"),
        rootCauseStatement: text(body.rootCauseStatement, "Akar masalah"),
        correctiveAction: text(body.correctiveAction, "Tindakan korektif"),
        successIndicator: text(body.successIndicator, "Indikator keberhasilan"),
        targetDate,
    };
}
function capaLinkData(action, auditQuestionId, evidenceTitle, evidenceUrl, userId) {
    return {
        code: `CAPA-LINK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: action.workspaceId,
        auditQuestionId,
        evidenceType: "LINK",
        title: evidenceTitle,
        description: `${exports.CAPA_EVIDENCE_MARKER}${action.id}`,
        fileName: evidenceTitle,
        mimeType: "text/uri-list",
        fileSizeBytes: 0,
        storageKey: evidenceUrl,
        checksum: (0, node_crypto_1.createHash)("sha256").update(evidenceUrl).digest("hex"),
        confidentiality: "INTERNAL",
        reviewStatus: "PENDING",
        uploadedById: userId,
    };
}
function httpsUrl(value) {
    const raw = text(value, "Link bukti CAPA");
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        throw new common_1.BadRequestException("Link bukti CAPA tidak valid.");
    }
    if (parsed.protocol !== "https:") {
        throw new common_1.BadRequestException("Link bukti CAPA wajib menggunakan HTTPS.");
    }
    return parsed.toString();
}
let CapaVerificationController = class CapaVerificationController {
    flow;
    schedule;
    constructor(flow, schedule) {
        this.flow = flow;
        this.schedule = schedule;
    }
    async editableCapa(actionId, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id: actionId },
            include: { workspace: true, finding: true, verifications: true },
        });
        if (action.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(action.workspace.status, CAPA_OPEN_WORKSPACE_STATUSES);
        if (action.status !== "READY_VERIFY") {
            throw new common_1.BadRequestException("CAPA ini tidak sedang menunggu verifikasi.");
        }
        if (action.verifications.some((item) => !item.decidedAt)) {
            throw new common_1.BadRequestException("Auditor sudah memberi rekomendasi, CAPA tidak dapat diubah lagi.");
        }
        await this.schedule.requireOpen(action.workspaceId, "FOLLOW_UP");
        return action;
    }
    async capaLinks(actionId) {
        return this.flow.prisma.evidence.findMany({
            where: {
                deletedAt: null,
                description: `${exports.CAPA_EVIDENCE_MARKER}${actionId}`,
            },
            select: { id: true },
        });
    }
    async flowDetail(id, user) {
        const workspace = await this.flow.workspace(id, user);
        const [findings, evidences] = await Promise.all([
            this.flow.prisma.finding.findMany({
                where: { workspaceId: id },
                include: {
                    question: {
                        select: {
                            id: true,
                            publishedQuestion: true,
                            questionSnapshot: true,
                            masterQuestion: {
                                select: { isoClauseId: true, criterionSource: true },
                            },
                        },
                    },
                    actions: {
                        include: { verifications: { orderBy: { verificationDate: "desc" } } },
                        orderBy: { updatedAt: "desc" },
                    },
                },
                orderBy: { code: "asc" },
            }),
            this.flow.prisma.evidence.findMany({
                where: {
                    workspaceId: id,
                    deletedAt: null,
                    description: { startsWith: exports.CAPA_EVIDENCE_MARKER },
                },
                include: { uploadedBy: { select: { id: true, fullName: true } } },
                orderBy: { uploadedAt: "desc" },
            }),
        ]);
        const evidenceByAction = new Map();
        for (const evidence of evidences) {
            const actionId = String(evidence.description || "").slice(exports.CAPA_EVIDENCE_MARKER.length);
            const list = evidenceByAction.get(actionId) || [];
            list.push(evidence);
            evidenceByAction.set(actionId, list);
        }
        const [window, reportingWindow] = await Promise.all([
            this.schedule.state(id, "FOLLOW_UP"),
            this.schedule.state(id, "REPORTING"),
        ]);
        return {
            workspace,
            capaWindow: { open: window.open, deadline: window.deadline },
            findingEditWindow: {
                open: workspace.status === "REPORTING" && reportingWindow.open,
                deadline: reportingWindow.deadline,
            },
            findings: findings.map((finding) => ({
                ...finding,
                isIso: isIsoMaster(finding.question?.masterQuestion),
                actions: finding.actions.map((action) => ({
                    ...action,
                    evidences: evidenceByAction.get(action.id) || [],
                })),
            })),
        };
    }
    async submitCapa(id, body, user) {
        const finding = await this.flow.prisma.finding.findUniqueOrThrow({
            where: { id },
            include: {
                workspace: true,
                actions: { orderBy: { updatedAt: "desc" }, take: 1 },
            },
        });
        if (finding.workspace.unitId !== user.unitId) {
            throw new common_1.ForbiddenException("Bukan Auditee unit target.");
        }
        this.flow.requireStatus(finding.workspace.status, ["FOLLOW_UP", "REPORT_REVIEW"]);
        this.flow.requireStatus(finding.status, [
            "OPEN",
            "CAPA_REVIEW",
            "IMPLEMENTATION",
            "VERIFICATION",
        ]);
        const payload = capaPayload(body);
        const targetDate = payload.targetDate;
        const evidenceTitle = text(body.evidenceTitle, "Nama dokumen bukti CAPA");
        const evidenceUrl = httpsUrl(body.evidenceUrl);
        const previous = finding.actions[0];
        const result = await this.flow.prisma.$transaction(async (tx) => {
            const action = previous && previous.status !== "EFFECTIVE"
                ? await tx.correctiveAction.update({
                    where: { id: previous.id },
                    data: {
                        ...payload,
                        progressPercent: 100,
                        progressNote: String(body.progressNote || "CAPA dikirim untuk verifikasi.").trim(),
                        status: "READY_VERIFY",
                    },
                })
                : await tx.correctiveAction.create({
                    data: {
                        ...payload,
                        findingId: id,
                        workspaceId: finding.workspaceId,
                        progressPercent: 100,
                        progressNote: String(body.progressNote || "CAPA dikirim untuk verifikasi.").trim(),
                        status: "READY_VERIFY",
                    },
                });
            const evidence = await tx.evidence.create({
                data: capaLinkData(action, finding.auditQuestionId, evidenceTitle, evidenceUrl, user.id),
            });
            await tx.finding.update({ where: { id }, data: { status: "VERIFICATION" } });
            return { action, evidence };
        });
        for (const role of ["AUDITOR", "LEAD_AUDITOR"]) {
            await this.flow.notifyRole(finding.workspaceId, role, "VERIFICATION_REQUESTED", "CAPA siap diverifikasi", `${finding.code}: Auditee mengirim CAPA dan link bukti pelaksanaan.`, "CorrectiveAction", result.action.id);
        }
        await this.flow.log(user.id, user.username, "CAPA_SUBMITTED_FOR_VERIFICATION", "CorrectiveAction", result.action.id, finding.workspaceId, {
            findingCode: finding.code,
            evidenceTitle,
            evidenceUrl,
            targetDate: targetDate.toISOString(),
        });
        return result;
    }
    async updateFinding(id, body, user) {
        const finding = await this.flow.prisma.finding.findUniqueOrThrow({
            where: { id },
            include: { question: { include: { masterQuestion: true } } },
        });
        const workspace = await this.flow.workspace(finding.workspaceId, user);
        this.flow.requireAssignment(workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(workspace.status, ["REPORTING"]);
        this.flow.requireStatus(finding.status, EDITABLE_FINDING_STATUSES);
        await this.schedule.requireOpen(workspace.id, "REPORTING");
        const iso = isIsoMaster(finding.question?.masterQuestion);
        let findingType = String(finding.findingType);
        if (!iso && body.findingType) {
            findingType = String(body.findingType).trim().toUpperCase();
            if (!FINDING_TYPES.has(findingType)) {
                throw new common_1.BadRequestException("Klasifikasi temuan harus OBS, KTS/NC Minor, atau KTS/NC Mayor.");
            }
        }
        const dueDate = new Date(text(body.dueDate, "Batas waktu perbaikan"));
        if (Number.isNaN(dueDate.getTime())) {
            throw new common_1.BadRequestException("Batas waktu perbaikan tidak valid.");
        }
        const data = {
            findingType: findingType,
            criteriaRegulation: text(body.criteriaRegulation, "Kriteria standar/regulasi"),
            criteriaIso: String(body.criteriaIso ?? "").trim() || "—",
            condition: text(body.condition, "Kondisi"),
            objectiveEvidence: text(body.objectiveEvidence, "Bukti objektif"),
            gapStatement: text(body.gapStatement, "Kesenjangan"),
            riskImpact: text(body.riskImpact, "Dampak risiko"),
            dueDate,
        };
        const before = {
            findingType: finding.findingType,
            criteriaRegulation: finding.criteriaRegulation,
            criteriaIso: finding.criteriaIso,
            condition: finding.condition,
            objectiveEvidence: finding.objectiveEvidence,
            gapStatement: finding.gapStatement,
            riskImpact: finding.riskImpact,
            dueDate: finding.dueDate?.toISOString() ?? null,
        };
        const changed = Object.keys(data).filter((key) => String(key === "dueDate" ? data.dueDate.toISOString() : data[key]) !==
            String(before[key] ?? ""));
        if (!changed.length)
            return finding;
        const updated = await this.flow.prisma.$transaction(async (tx) => {
            const result = await tx.finding.update({ where: { id }, data });
            if (!iso && findingType !== finding.findingType && finding.auditQuestionId) {
                await tx.workpaper.updateMany({
                    where: {
                        auditQuestionId: finding.auditQuestionId,
                        auditStatus: finding.findingType,
                    },
                    data: { auditStatus: findingType },
                });
            }
            return result;
        });
        await this.flow.log(user.id, user.username, "FINDING_UPDATED", "Finding", id, finding.workspaceId, {
            findingCode: finding.code,
            changed,
            ...Object.fromEntries(changed.map((key) => [
                key,
                key === "dueDate" ? data.dueDate.toISOString() : data[key],
            ])),
        }, Object.fromEntries(changed.map((key) => [key, before[key]])));
        return updated;
    }
    async updateCapa(id, body, user) {
        const action = await this.editableCapa(id, user);
        const payload = capaPayload(body);
        const wantsLink = String(body.evidenceUrl ?? "").trim() !== "";
        const evidenceTitle = wantsLink
            ? text(body.evidenceTitle, "Nama dokumen bukti CAPA")
            : "";
        const evidenceUrl = wantsLink ? httpsUrl(body.evidenceUrl) : "";
        const updated = await this.flow.prisma.$transaction(async (tx) => {
            const result = await tx.correctiveAction.update({
                where: { id },
                data: {
                    ...payload,
                    progressNote: String(body.progressNote ?? action.progressNote ?? "").trim() || null,
                },
            });
            if (wantsLink) {
                await tx.evidence.create({
                    data: capaLinkData(action, action.finding.auditQuestionId, evidenceTitle, evidenceUrl, user.id),
                });
            }
            return result;
        });
        await this.flow.log(user.id, user.username, "CAPA_UPDATED", "CorrectiveAction", id, action.workspaceId, {
            findingCode: action.finding.code,
            targetDate: payload.targetDate.toISOString(),
            ...(wantsLink ? { evidenceTitle, evidenceUrl } : {}),
        });
        return updated;
    }
    async deleteCapaEvidence(id, user) {
        const evidence = await this.flow.prisma.evidence.findUniqueOrThrow({
            where: { id },
        });
        const description = String(evidence.description || "");
        if (!description.startsWith(exports.CAPA_EVIDENCE_MARKER) || evidence.deletedAt) {
            throw new common_1.BadRequestException("Link bukti CAPA tidak ditemukan.");
        }
        const actionId = description.slice(exports.CAPA_EVIDENCE_MARKER.length);
        const action = await this.editableCapa(actionId, user);
        const links = await this.capaLinks(actionId);
        if (links.length <= 1) {
            throw new common_1.BadRequestException("CAPA wajib memiliki minimal satu link bukti. Tambahkan link baru dulu, atau tarik CAPA.");
        }
        await this.flow.prisma.evidence.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        await this.flow.log(user.id, user.username, "CAPA_EVIDENCE_DELETED", "Evidence", id, action.workspaceId, {
            findingCode: action.finding.code,
            evidenceTitle: evidence.title,
            evidenceUrl: evidence.storageKey,
        });
        return { ok: true };
    }
    async withdrawCapa(id, user) {
        const action = await this.editableCapa(id, user);
        const links = await this.capaLinks(id);
        const firstCycle = action.verifications.length === 0;
        await this.flow.prisma.$transaction(async (tx) => {
            if (links.length) {
                await tx.evidence.updateMany({
                    where: { id: { in: links.map((link) => link.id) } },
                    data: { deletedAt: new Date() },
                });
            }
            if (firstCycle) {
                await tx.correctiveAction.delete({ where: { id } });
                await tx.finding.update({
                    where: { id: action.findingId },
                    data: { status: "OPEN" },
                });
            }
            else {
                await tx.correctiveAction.update({
                    where: { id },
                    data: { status: "NOT_EFFECTIVE" },
                });
                await tx.finding.update({
                    where: { id: action.findingId },
                    data: { status: "IMPLEMENTATION" },
                });
            }
        });
        await this.flow.log(user.id, user.username, "CAPA_WITHDRAWN", "CorrectiveAction", id, action.workspaceId, { findingCode: action.finding.code, deletedAction: firstCycle });
        return { ok: true, deleted: firstCycle };
    }
    async auditorVerification(id, body, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } }, finding: true },
        });
        this.flow.requireAssignment(action.workspace, user, ["AUDITOR", "LEAD_AUDITOR"]);
        this.flow.requireStatus(action.status, ["READY_VERIFY"]);
        const decision = String(body.decision || "").trim().toUpperCase();
        if (!["CLOSE", "OPEN"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih rekomendasi Close atau Tetap Open.");
        }
        const implementationResult = text(body.implementationResult, "Hasil pemeriksaan implementasi");
        const effectivenessResult = text(body.effectivenessResult, "Catatan rekomendasi Auditor");
        const status = decision === "CLOSE" ? "EFFECTIVE" : "NOT_EFFECTIVE";
        const existing = await this.flow.prisma.verification.findFirst({
            where: { actionId: id, decidedAt: null },
            orderBy: { verificationDate: "desc" },
        });
        const verification = existing
            ? await this.flow.prisma.verification.update({
                where: { id: existing.id },
                data: {
                    verifierUserId: user.id,
                    auditorUserId: user.id,
                    implementationResult,
                    effectivenessResult,
                    status,
                    nextReviewDate: body.nextReviewDate
                        ? new Date(body.nextReviewDate)
                        : null,
                },
            })
            : await this.flow.prisma.verification.create({
                data: {
                    actionId: id,
                    verifierUserId: user.id,
                    auditorUserId: user.id,
                    implementationResult,
                    effectivenessResult,
                    status,
                    nextReviewDate: body.nextReviewDate
                        ? new Date(body.nextReviewDate)
                        : null,
                },
            });
        await this.flow.notifyRole(action.workspaceId, "LEAD_AUDITOR", "VERIFICATION_REQUESTED", "Rekomendasi verifikasi CAPA menunggu keputusan", `${action.finding.code}: Auditor merekomendasikan ${decision === "CLOSE" ? "Close" : "Tetap Open"}.`, "Verification", verification.id);
        await this.flow.log(user.id, user.username, "CAPA_AUDITOR_RECOMMENDATION", "Verification", verification.id, action.workspaceId, { findingCode: action.finding.code, decision, implementationResult, effectivenessResult });
        return verification;
    }
    async leadVerification(id, body, user) {
        const action = await this.flow.prisma.correctiveAction.findUniqueOrThrow({
            where: { id },
            include: { workspace: { include: { team: true } }, finding: true },
        });
        this.flow.requireAssignment(action.workspace, user, ["LEAD_AUDITOR"]);
        this.flow.requireStatus(action.status, ["READY_VERIFY"]);
        const recommendation = await this.flow.prisma.verification.findFirst({
            where: { actionId: id, auditorUserId: { not: null }, decidedAt: null },
            orderBy: { verificationDate: "desc" },
        });
        if (!recommendation) {
            throw new common_1.BadRequestException("Auditor belum memberikan rekomendasi Close atau Open.");
        }
        const decision = String(body.decision || "").trim().toUpperCase();
        if (!["CLOSE", "OPEN"].includes(decision)) {
            throw new common_1.BadRequestException("Pilih keputusan final Close atau Tetap Open.");
        }
        const note = text(body.note, "Catatan keputusan Ketua Auditor");
        const close = decision === "CLOSE";
        const now = new Date();
        const verification = await this.flow.prisma.$transaction(async (tx) => {
            const saved = await tx.verification.update({
                where: { id: recommendation.id },
                data: {
                    leadAuditorUserId: user.id,
                    effectivenessResult: note,
                    status: close ? "EFFECTIVE" : "NOT_EFFECTIVE",
                    decidedAt: now,
                    closedAt: close ? now : null,
                },
            });
            await tx.correctiveAction.update({
                where: { id },
                data: {
                    status: close ? "EFFECTIVE" : "IN_PROGRESS",
                    progressPercent: close ? 100 : action.progressPercent,
                    progressNote: note,
                },
            });
            await tx.finding.update({
                where: { id: action.findingId },
                data: { status: close ? "CLOSED" : "IMPLEMENTATION" },
            });
            return saved;
        });
        const auditees = await this.flow.prisma.user.findMany({
            where: {
                unitId: action.workspace.unitId,
                status: "ACTIVE",
                deletedAt: null,
                roles: { some: { role: { code: "AUDITEE" } } },
            },
            select: { id: true },
        });
        if (auditees.length) {
            await this.flow.prisma.notification.createMany({
                data: auditees.map((auditee) => ({
                    workspaceId: action.workspaceId,
                    recipientUserId: auditee.id,
                    event: close ? "FINDING_CLOSED" : "ACTION_RETURNED",
                    title: close ? "Temuan ditutup" : "Temuan tetap Open",
                    message: `${action.finding.code}: ${note}`,
                    entityType: "Finding",
                    entityId: action.findingId,
                })),
            });
        }
        await this.flow.log(user.id, user.username, close ? "CAPA_LEAD_DECISION_CLOSE" : "CAPA_LEAD_DECISION_OPEN", "Verification", verification.id, action.workspaceId, { findingCode: action.finding.code, decision, note });
        return verification;
    }
};
exports.CapaVerificationController = CapaVerificationController;
__decorate([
    (0, common_1.Get)("workspaces/:id/capa-flow"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "flowDetail", null);
__decorate([
    (0, common_1.Post)("findings/:id/capa-submit"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "submitCapa", null);
__decorate([
    (0, common_1.Post)("findings/:id/update"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "updateFinding", null);
__decorate([
    (0, common_1.Post)("actions/:id/capa-update"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "updateCapa", null);
__decorate([
    (0, common_1.Delete)("capa-evidences/:id"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "deleteCapaEvidence", null);
__decorate([
    (0, common_1.Post)("actions/:id/capa-withdraw"),
    (0, auth_1.Roles)("AUDITEE"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "withdrawCapa", null);
__decorate([
    (0, common_1.Post)("actions/:id/auditor-verification"),
    (0, auth_1.Roles)("AUDITOR", "KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "auditorVerification", null);
__decorate([
    (0, common_1.Post)("actions/:id/lead-verification"),
    (0, auth_1.Roles)("KETUA_AUDITOR"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CapaVerificationController.prototype, "leadVerification", null);
exports.CapaVerificationController = CapaVerificationController = __decorate([
    (0, common_1.Controller)("audit-flow"),
    __metadata("design:paramtypes", [ami_workflow_service_1.AmiWorkflowService,
        audit_schedule_service_1.AuditScheduleService])
], CapaVerificationController);
//# sourceMappingURL=capa-verification.controller.js.map