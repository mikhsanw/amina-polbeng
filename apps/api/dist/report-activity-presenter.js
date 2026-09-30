"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presentActivity = presentActivity;
const ACTIVITY_TEXT = {
    WORKFLOW_DEADLINES_UPDATED: {
        stage: "Perencanaan",
        activity: "Admin Mutu memperbarui batas waktu tahapan audit.",
    },
    INSTRUMENT_PUBLISHED: {
        stage: "Instrumen",
        activity: "Instrumen audit dipublikasikan kepada Auditee.",
    },
    INSTRUMENT_PUBLISHED_WITH_DEADLINES: {
        stage: "Instrumen",
        activity: "Admin Mutu mempublikasikan instrumen beserta batas waktu pengisian dan review.",
    },
    SELF_ASSESSMENT_SUBMITTED: {
        stage: "Self-assessment",
        activity: "Auditee mengirim jawaban dan bukti untuk diperiksa Auditor.",
    },
    SELF_ASSESSMENT_APPROVED: {
        stage: "Self-assessment",
        activity: "Penilaian mandiri unit disahkan dan siap diperiksa.",
    },
    SELF_ASSESSMENT_RETURNED: {
        stage: "Self-assessment",
        activity: "Jawaban atau bukti dikembalikan untuk diperbaiki.",
    },
    SELF_ASSESSMENT_DESK_ACCEPTED: {
        stage: "Desk review",
        activity: "Auditor menerima butir pada pemeriksaan dokumen.",
    },
    SELF_ASSESSMENT_FIELD_CORRECTION_REQUIRED: {
        stage: "Desk review",
        activity: "Auditor menandai butir untuk diperbaiki saat assessment lapangan.",
    },
    DESK_REVIEW_SUBMITTED_TO_ADMIN: {
        stage: "Desk review",
        activity: "Ketua Auditor mengirim hasil review kepada Admin Mutu.",
    },
    DESK_REVIEW_APPROVED_BY_ADMIN: {
        stage: "Desk review",
        activity: "Admin Mutu menyetujui hasil review dan membuka assessment lapangan.",
    },
    DESK_REVIEW_RETURNED_BY_ADMIN: {
        stage: "Desk review",
        activity: "Admin Mutu mengembalikan hasil review kepada tim audit.",
    },
    EVIDENCE_VALIDATED: {
        stage: "Pemeriksaan bukti",
        activity: "Auditor menyatakan dokumen bukti valid.",
    },
    EVIDENCE_INVALIDATED: {
        stage: "Pemeriksaan bukti",
        activity: "Auditor menyatakan dokumen bukti tidak valid.",
    },
    FIELD_CORRECTION_SUBMITTED: {
        stage: "Assessment lapangan",
        activity: "Auditee memberi tahu bahwa perbaikan lapangan telah disimpan untuk diperiksa.",
    },
    FIELD_ASSESSMENT_SAVED: {
        stage: "Assessment lapangan",
        activity: "Auditor menyimpan hasil assessment lapangan.",
    },
    FIELD_AUDIT_DECISION_SAVED: {
        stage: "Assessment lapangan",
        activity: "Auditor menetapkan hasil akhir pemeriksaan lapangan pada satu butir.",
    },
    WORKPAPER_SUBMITTED: {
        stage: "Kertas kerja",
        activity: "Auditor mengajukan kertas kerja kepada Ketua Auditor.",
    },
    WORKPAPER_APPROVED: {
        stage: "Kertas kerja",
        activity: "Ketua Auditor menyetujui kertas kerja.",
    },
    WORKPAPER_RETURNED: {
        stage: "Kertas kerja",
        activity: "Ketua Auditor mengembalikan kertas kerja untuk diperbaiki.",
    },
    FINDING_CREATED: {
        stage: "Temuan",
        activity: "Sistem mencatat temuan audit berdasarkan hasil pemeriksaan lapangan.",
    },
    FINDING_PUBLISHED: {
        stage: "Temuan",
        activity: "Temuan audit diterbitkan untuk ditindaklanjuti Auditee.",
    },
    CAPA_SUBMITTED_FOR_VERIFICATION: {
        stage: "Tindak lanjut",
        activity: "Auditee mengirim CAPA dan bukti pelaksanaan untuk diverifikasi.",
    },
    CAPA_AUDITOR_RECOMMENDATION: {
        stage: "Verifikasi CAPA",
        activity: "Auditor memberikan rekomendasi Close atau Tetap Open.",
    },
    CAPA_LEAD_DECISION: {
        stage: "Verifikasi CAPA",
        activity: "Ketua Auditor menetapkan keputusan final terhadap tindak lanjut.",
    },
    CORRECTIVE_ACTION_SUBMITTED: {
        stage: "Tindak lanjut",
        activity: "CAPA dikirim untuk diperiksa.",
    },
    ACTION_RETURNED: {
        stage: "Tindak lanjut",
        activity: "Tindak lanjut dikembalikan kepada Auditee karena belum efektif.",
    },
    FINDING_CLOSED: {
        stage: "Tindak lanjut",
        activity: "Temuan dinyatakan selesai dan ditutup.",
    },
    AUDIT_REPORT_VERSION_CREATED: {
        stage: "Laporan",
        activity: "Versi laporan audit dibuat untuk diperiksa dan ditandatangani.",
    },
    SIGNED_AUDIT_ARCHIVE_UPLOADED: {
        stage: "Archive",
        activity: "Laporan yang telah ditandatangani diunggah ke Archive.",
    },
    SIGNED_AUDIT_ARCHIVE_VALIDATED: {
        stage: "Archive",
        activity: "Admin Mutu menyatakan laporan bertanda tangan lengkap dan valid.",
    },
    SIGNED_AUDIT_ARCHIVE_INVALIDATED: {
        stage: "Archive",
        activity: "Admin Mutu mengembalikan laporan bertanda tangan untuk diperbaiki.",
    },
    AUDIT_CLOSED: {
        stage: "Penutupan",
        activity: "Admin Mutu menyelesaikan dan menutup audit unit.",
    },
};
function readableFallback(action) {
    const phrase = action
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .join(" ")
        .replace(/\baudit\b/g, "audit")
        .replace(/\bcapa\b/g, "CAPA");
    return phrase ? `Sistem mencatat kegiatan: ${phrase}.` : "Sistem mencatat satu kegiatan audit.";
}
function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function clean(value) {
    return String(value ?? "")
        .replaceAll("_", " ")
        .replace(/\s+/g, " ")
        .trim();
}
function formatDate(value) {
    if (!value)
        return "";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
        ? clean(value)
        : date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}
function presentActivity(log) {
    const action = String(log.action || "").trim().toUpperCase();
    const preset = ACTIVITY_TEXT[action] || {
        stage: "Proses audit",
        activity: readableFallback(action),
    };
    const detail = objectValue(log.newValue);
    const notes = [];
    const noteKeys = [
        "note",
        "validationNote",
        "reason",
        "changeReason",
        "progressNote",
        "effectivenessResult",
        "implementationResult",
        "message",
    ];
    for (const key of noteKeys) {
        const value = clean(detail[key]);
        if (value && !notes.includes(value))
            notes.push(value);
    }
    const decision = clean(detail.decision);
    if (decision)
        notes.push(`Keputusan: ${decision}.`);
    const status = clean(detail.status);
    if (status)
        notes.push(`Status: ${status}.`);
    const findingCode = clean(detail.findingCode);
    if (findingCode)
        notes.push(`Temuan: ${findingCode}.`);
    const title = clean(detail.title);
    const fileName = clean(detail.fileName);
    if (title || fileName)
        notes.push(`Dokumen: ${title || fileName}.`);
    const deadlineFields = [
        ["selfAssessmentEnd", "Batas pengisian Auditee"],
        ["selfAssessmentReviewEnd", "Batas review Auditor"],
        ["fieldAuditEnd", "Batas assessment lapangan"],
        ["reportingEnd", "Batas penyusunan laporan"],
        ["followUpEnd", "Batas tindak lanjut"],
        ["targetDate", "Target penyelesaian"],
        ["deadline", "Batas waktu"],
    ];
    for (const [key, label] of deadlineFields) {
        const value = formatDate(detail[key]);
        if (value)
            notes.push(`${label}: ${value}.`);
    }
    return {
        time: new Date(log.createdAt).toLocaleString("id-ID"),
        actor: clean(log.username) || "Sistem",
        stage: preset.stage,
        activity: preset.activity,
        note: notes.join(" ") || "Tidak ada catatan tambahan.",
    };
}
//# sourceMappingURL=report-activity-presenter.js.map