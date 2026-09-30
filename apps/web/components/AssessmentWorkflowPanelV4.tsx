"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { EvidenceFileLinks } from "./EvidenceFileLinks";
import { AssessmentWorkflowPanel as FieldAssessmentPanel } from "./AssessmentWorkflowPanelV2";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const statusLabel = (value: unknown) => {
  const text = String(value ?? "—");
  const labels: Record<string, string> = {
    PENDING: "Belum diperiksa",
    VALID: "Valid",
    INVALID: "Tidak valid",
    DESK_ACCEPTED: "Diterima pada desk review",
    FIELD_PENDING: "Menunggu assessment lapangan",
    NOT_STARTED: "Belum diisi",
    IN_PROGRESS: "Sedang diperbaiki Auditee",
    SUBMITTED: "Menunggu review Auditor",
    RETURNED: "Perlu perbaikan saat lapangan",
    APPROVED: "Selesai",
    OPEN: "Menjadi temuan",
  };
  return labels[text] || text.replaceAll("_", " ");
};

const isAssignedAuditor = (assignment?: string) =>
  ["AUDITOR", "LEAD_AUDITOR"].includes(assignment || "");

export function AssessmentWorkflowPanel(props: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const { workspace, myAssignment } = props;
  if (workspace.status === "FIELD_AUDIT" && isAssignedAuditor(myAssignment)) {
    return <FieldAssessmentPanel {...props} />;
  }
  return <SelfAssessmentDeskPanel {...props} />;
}

function SelfAssessmentDeskPanel({
  workspace,
  user,
  myAssignment,
  busy,
  run,
}: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setData(await api(`/audit-flow/workspaces/${workspace.id}/assessment-flow`));
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Data penilaian dan bukti gagal dimuat.");
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    const onEvidenceChanged = (event: Event) => {
      const workspaceId = (event as CustomEvent)?.detail?.workspaceId;
      if (!workspaceId || workspaceId === workspace.id) load();
    };
    window.addEventListener("sami:evidence-changed", onEvidenceChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("sami:evidence-changed", onEvidenceChanged);
    };
  }, [workspace.id]);

  async function perform(
    path: string,
    init?: RequestInit,
    success = "Perubahan disimpan.",
  ) {
    const ok = await run(path, init, success);
    if (ok) {
      await load();
      setMessage(success);
      setError("");
    }
    return ok;
  }

  const questions = data?.questions || [];
  const evidences = data?.evidences || [];
  const isAuditee =
    user.roles?.includes("AUDITEE") && workspace.unitId === user.unitId;
  const isAuditor = isAssignedAuditor(myAssignment);
  const isLead = myAssignment === "LEAD_AUDITOR";

  const reviewSummary = useMemo(() => {
    const accepted = questions.filter(
      (question: any) =>
        question.assessment?.responseStatus === "DESK_ACCEPTED",
    ).length;
    const returned = questions.filter(
      (question: any) => question.assessment?.responseStatus === "RETURNED",
    ).length;
    const unresolved = questions.length - accepted - returned;
    const pendingEvidence = evidences.filter(
      (evidence: any) => evidence.reviewStatus === "PENDING",
    ).length;
    const invalidEvidence = evidences.filter(
      (evidence: any) => evidence.reviewStatus === "INVALID",
    ).length;
    return {
      accepted,
      returned,
      unresolved,
      pendingEvidence,
      invalidEvidence,
      ready:
        questions.length > 0 && unresolved === 0 && pendingEvidence === 0,
    };
  }, [questions, evidences]);

  if (!data) {
    return (
      <section className="ami-panel">
        <div className="empty">Memuat penilaian dan bukti…</div>
      </section>
    );
  }

  const title =
    workspace.status === "DESK_REVIEW"
      ? "Review Jawaban dan Bukti"
      : workspace.status === "FIELD_AUDIT"
        ? "Perbaikan Auditee saat Assessment Lapangan"
        : "Self-Assessment Auditee";

  return (
    <div className="assessment-flow-v4">
      <section className="ami-panel">
        <div className="ami-panel-title">
          <div>
            <h2>{title}</h2>
            <p>
              {workspace.status === "DESK_REVIEW"
                ? "Butir yang dikembalikan tetap berada dalam review Ketua Auditor. Auditee baru dapat memperbaikinya ketika assessment lapangan dibuka."
                : workspace.status === "FIELD_AUDIT"
                  ? "Hanya butir yang ditandai perlu perbaikan yang dapat diubah oleh Auditee pada tahap ini."
                  : "File tersedia segera setelah upload. Status Belum diperiksa berarti Auditor belum memberi keputusan."}
            </p>
          </div>
          <span className="ami-pill">
            {questions.length} butir · {evidences.length} bukti
          </span>
        </div>

        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        {workspace.status === "DESK_REVIEW" && (
          <div className="review-summary">
            <span>Diterima: <b>{reviewSummary.accepted}</b></span>
            <span>Perbaikan lapangan: <b>{reviewSummary.returned}</b></span>
            <span>Belum diputuskan: <b>{reviewSummary.unresolved}</b></span>
            <span>Bukti belum diperiksa: <b>{reviewSummary.pendingEvidence}</b></span>
            <span>Bukti tidak valid: <b>{reviewSummary.invalidEvidence}</b></span>
          </div>
        )}

        <div className="stage-actions">
          {isAuditee && workspace.status === "SELF_ASSESSMENT" && (
            <button
              type="button"
              className="primary"
              disabled={busy || !questions.length}
              onClick={() =>
                perform(
                  `/audit-flow/workspaces/${workspace.id}/assessments/submit-auditee`,
                  { method: "POST", body: "{}" },
                  "Self-assessment dikirim kepada Auditor.",
                )
              }
            >
              Kirim Self-Assessment
            </button>
          )}

          {isLead && workspace.status === "DESK_REVIEW" && (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy || !reviewSummary.ready}
                onClick={() =>
                  perform(
                    `/audit-flow/workspaces/${workspace.id}/desk-review/submit`,
                    { method: "POST", body: "{}" },
                    "Hasil review dikirim kepada Admin Mutu.",
                  )
                }
              >
                Kirim Hasil Review ke Admin Mutu
              </button>
              {!reviewSummary.ready && (
                <span className="muted">
                  Semua butir harus sudah diputuskan dan semua bukti harus sudah
                  diperiksa. Bukti Tidak Valid boleh diteruskan sebagai bahan
                  perbaikan saat assessment lapangan.
                </span>
              )}
            </>
          )}
        </div>
      </section>

      <div className="assessment-question-list">
        {questions.map((question: any) => (
          <QuestionCard
            key={question.id}
            question={question}
            workspace={workspace}
            isAuditee={isAuditee}
            isAuditor={isAuditor}
            myAssignment={myAssignment}
            busy={busy}
            perform={perform}
            reload={load}
          />
        ))}
      </div>

      <style jsx>{`
        .assessment-flow-v4 { display: grid; gap: 1rem; }
        .stage-actions { display: flex; align-items: center; flex-wrap: wrap; gap: .7rem; margin-top: 1rem; }
        .assessment-question-list { display: grid; gap: 1rem; }
        .review-summary { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .85rem; }
        .review-summary span { padding: .45rem .65rem; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: .82rem; }
      `}</style>
    </div>
  );
}

function QuestionCard({
  question,
  workspace,
  isAuditee,
  isAuditor,
  myAssignment,
  busy,
  perform,
  reload,
}: {
  question: any;
  workspace: any;
  isAuditee: boolean;
  isAuditor: boolean;
  myAssignment?: string;
  busy: boolean;
  perform: RunAction;
  reload: () => Promise<void>;
}) {
  const assessment = question.assessment || {};
  const [draft, setDraft] = useState<any>({
    implementationDescription: assessment.implementationDescription || "",
    evidenceSummary: assessment.evidenceSummary || "",
    constraintNote: assessment.constraintNote || "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ title: "", url: "" });

  useEffect(() => {
    setDraft({
      implementationDescription: assessment.implementationDescription || "",
      evidenceSummary: assessment.evidenceSummary || "",
      constraintNote: assessment.constraintNote || "",
    });
  }, [assessment.id, assessment.updatedAt]);

  const auditeeEditable =
    isAuditee &&
    ((workspace.status === "SELF_ASSESSMENT" &&
      ["NOT_STARTED", "IN_PROGRESS", undefined].includes(
        assessment.responseStatus,
      )) ||
      (workspace.status === "FIELD_AUDIT" &&
        ["RETURNED", "IN_PROGRESS"].includes(
          assessment.responseStatus,
        )));

  const auditorReviewable =
    isAuditor &&
    workspace.status === "DESK_REVIEW" &&
    (assessment.responseStatus === "SUBMITTED" ||
      (myAssignment === "LEAD_AUDITOR" &&
        ["RETURNED", "DESK_ACCEPTED"].includes(
          assessment.responseStatus,
        )));

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("auditQuestionId", question.id);
    form.set("title", title || file.name);
    form.set("evidenceType", "OTHER");
    setUploading(true);
    try {
      await api(
        `/audit-flow/workspaces/${workspace.id}/assessment-evidences/upload`,
        { method: "POST", body: form },
      );
      setFile(null);
      setTitle("");
      window.dispatchEvent(
        new CustomEvent("sami:evidence-changed", {
          detail: { workspaceId: workspace.id },
        }),
      );
      await reload();
    } finally {
      setUploading(false);
    }
  }

  async function saveLink(event: FormEvent) {
    event.preventDefault();
    const ok = await perform(
      `/audit-flow/workspaces/${workspace.id}/assessment-evidences/link`,
      {
        method: "POST",
        body: JSON.stringify({
          auditQuestionId: question.id,
          title: linkDraft.title,
          url: linkDraft.url,
        }),
      },
      "Link Google Drive ditambahkan.",
    );
    if (ok) {
      setLinkOpen(false);
      setLinkDraft({ title: "", url: "" });
      window.dispatchEvent(
        new CustomEvent("sami:evidence-changed", {
          detail: { workspaceId: workspace.id },
        }),
      );
      await reload();
    }
  }

  async function reviewEvidence(
    evidence: any,
    decision: "VALID" | "INVALID",
  ) {
    let note = decision === "VALID" ? "Bukti sesuai." : "";
    if (decision === "INVALID") {
      note =
        window.prompt(
          "Alasan bukti tidak valid",
          evidence.validationNote || "",
        ) || "";
      if (!note.trim()) return;
    }
    await perform(
      `/audit-flow/assessment-evidences/${evidence.id}/review`,
      { method: "PATCH", body: JSON.stringify({ decision, note }) },
      decision === "VALID"
        ? "Bukti dinyatakan Valid."
        : "Bukti dinyatakan Tidak Valid.",
    );
  }

  async function reviewAssessment(decision: "ACCEPT" | "RETURN") {
    let note = assessment.returnNote || "";
    if (decision === "RETURN") {
      note =
        window.prompt(
          "Catatan perbaikan untuk assessment lapangan",
          assessment.returnNote || "",
        ) || "";
      if (!note.trim()) return;
    }
    await perform(
      `/audit-flow/assessments/${assessment.id}/auditor-review`,
      { method: "POST", body: JSON.stringify({ decision, note }) },
      decision === "ACCEPT"
        ? "Butir diterima pada desk review."
        : "Butir ditandai untuk diperbaiki Auditee saat assessment lapangan.",
    );
  }

  return (
    <article className="ami-panel question-card-v4">
      <header>
        <div>
          <small>
            {question.masterQuestion?.code} · Butir {question.sortOrder}
          </small>
          <h3>{question.publishedQuestion || question.questionSnapshot}</h3>
          <p>
            Bukti yang diminta:{" "}
            {question.publishedExpectedEvidence ||
              question.defaultExpectedEvidence ||
              "—"}
          </p>
        </div>
        <span className="ami-pill">
          {statusLabel(assessment.responseStatus)}
        </span>
      </header>

      {assessment.responseStatus === "RETURNED" && assessment.returnNote && (
        <div className="return-note">
          <b>Catatan perbaikan saat assessment lapangan</b>
          <p>{assessment.returnNote}</p>
        </div>
      )}

      <div className="answer-grid">
        <div>
          <b>Jawaban Auditee</b>
          <p>{assessment.implementationDescription || "Belum diisi."}</p>
        </div>
        <div>
          <b>Keterangan bukti</b>
          <p>{assessment.evidenceSummary || "—"}</p>
        </div>
        <div>
          <b>Kendala</b>
          <p>{assessment.constraintNote || "—"}</p>
        </div>
      </div>

      {auditeeEditable && (
        <section className="auditee-editor">
          {workspace.status === "FIELD_AUDIT" && (
            <div className="field-correction-info">
              Perbaikan ini dibuka khusus pada tahap assessment lapangan.
            </div>
          )}
          <label>
            Uraian kondisi/pelaksanaan
            <textarea
              rows={4}
              value={draft.implementationDescription}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  implementationDescription: event.target.value,
                })
              }
            />
          </label>
          <label>
            Keterangan bukti
            <textarea
              rows={2}
              value={draft.evidenceSummary}
              onChange={(event) =>
                setDraft({ ...draft, evidenceSummary: event.target.value })
              }
            />
          </label>
          <label>
            Kendala atau kondisi khusus
            <textarea
              rows={2}
              value={draft.constraintNote}
              onChange={(event) =>
                setDraft({ ...draft, constraintNote: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="small primary"
            disabled={busy}
            onClick={() =>
              perform(
                `/audit-flow/assessments/${assessment.id}/auditee`,
                { method: "PATCH", body: JSON.stringify(draft) },
                workspace.status === "FIELD_AUDIT"
                  ? "Perbaikan lapangan disimpan."
                  : "Jawaban disimpan.",
              )
            }
          >
            {workspace.status === "FIELD_AUDIT"
              ? "Simpan Perbaikan Lapangan"
              : "Simpan Jawaban"}
          </button>
        </section>
      )}

      <section className="question-evidences">
        <div className="subheading">
          <b>Bukti terunggah</b>
          <span>{(question.evidences || []).length} bukti</span>
        </div>
        {(question.evidences || []).length ? (
          question.evidences.map((evidence: any) => (
            <div className="question-evidence-row" key={evidence.id}>
              <div>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/audit-flow/evidences/${evidence.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {evidence.title || evidence.fileName}
                </a>
                <small>
                  {statusLabel(evidence.reviewStatus)}
                  {evidence.validationNote
                    ? ` · ${evidence.validationNote}`
                    : ""}
                </small>
              </div>
              <EvidenceFileLinks evidence={evidence} compact />
              {isAuditor && workspace.status === "DESK_REVIEW" && (
                <div className="review-buttons">
                  <button
                    type="button"
                    className="small"
                    disabled={busy || evidence.reviewStatus === "VALID"}
                    onClick={() => reviewEvidence(evidence, "VALID")}
                  >
                    {evidence.reviewStatus === "INVALID"
                      ? "Ubah menjadi Valid"
                      : "Valid"}
                  </button>
                  <button
                    type="button"
                    className="small danger"
                    disabled={busy || evidence.reviewStatus === "INVALID"}
                    onClick={() => reviewEvidence(evidence, "INVALID")}
                  >
                    {evidence.reviewStatus === "VALID"
                      ? "Ubah menjadi Tidak Valid"
                      : "Tidak Valid"}
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <span className="muted">Belum ada bukti.</span>
        )}
      </section>

      {auditeeEditable && (
        <div className="evidence-add-actions">
          <form onSubmit={upload}>
            <input
              placeholder="Nama file"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              type="file"
              required
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button className="small" disabled={uploading || !file}>
              {uploading ? "Mengunggah…" : "Unggah File"}
            </button>
          </form>
          <button
            type="button"
            className="small"
            onClick={() => setLinkOpen(true)}
          >
            Tempel Link Google Drive
          </button>
        </div>
      )}

      {auditorReviewable && (
        <footer>
          <button
            type="button"
            className="small primary"
            disabled={busy}
            onClick={() => reviewAssessment("ACCEPT")}
          >
            {assessment.responseStatus === "DESK_ACCEPTED"
              ? "Tetap Diterima"
              : "Terima Butir"}
          </button>
          <button
            type="button"
            className="small danger"
            disabled={busy}
            onClick={() => reviewAssessment("RETURN")}
          >
            {assessment.responseStatus === "RETURNED"
              ? "Tetap Perbaiki saat Lapangan"
              : "Perbaiki saat Assessment Lapangan"}
          </button>
        </footer>
      )}

      {linkOpen && (
        <div className="ami-modal" role="dialog" aria-modal="true">
          <form className="ami-dialog link-dialog" onSubmit={saveLink}>
            <header>
              <div>
                <h3>Tempel Link Google Drive</h3>
                <p>
                  Nama file akan tampil sebagai tautan biru pada layar Auditor dan
                  laporan bukti.
                </p>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setLinkOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="link-fields">
              <label>
                Nama file atau dokumen
                <input
                  autoFocus
                  required
                  value={linkDraft.title}
                  onChange={(event) =>
                    setLinkDraft({ ...linkDraft, title: event.target.value })
                  }
                />
              </label>
              <label>
                Link Google Drive
                <input
                  required
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={linkDraft.url}
                  onChange={(event) =>
                    setLinkDraft({ ...linkDraft, url: event.target.value })
                  }
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setLinkOpen(false)}>
                Batal
              </button>
              <button className="primary" disabled={busy}>
                Simpan Link
              </button>
            </footer>
          </form>
        </div>
      )}

      <style jsx>{`
        .question-card-v4 { display: grid; gap: 1rem; }
        .question-card-v4 > header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        .question-card-v4 h3 { margin: .25rem 0; }
        .question-card-v4 p { margin: .25rem 0; color: #475569; }
        .answer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .7rem; }
        .answer-grid > div { padding: .75rem; border-radius: 10px; background: #f8fafc; }
        .return-note { padding: .75rem; border: 1px solid #fdba74; border-radius: 10px; background: #fff7ed; }
        .return-note p { margin-top: .3rem; }
        .auditee-editor { display: grid; gap: .7rem; padding: .85rem; border: 1px solid #dbe4ee; border-radius: 12px; }
        .field-correction-info { padding: .65rem; border-radius: 8px; background: #eff6ff; color: #1e40af; font-weight: 700; }
        .auditee-editor label, .link-fields label { display: grid; gap: .35rem; font-weight: 700; }
        .auditee-editor textarea, .link-fields input, .evidence-add-actions input { width: 100%; box-sizing: border-box; padding: .65rem; border: 1px solid #b8c7d9; border-radius: 8px; font: inherit; }
        .subheading { display: flex; justify-content: space-between; gap: .5rem; margin-bottom: .45rem; }
        .question-evidences { display: grid; gap: .55rem; }
        .question-evidence-row { display: flex; align-items: center; flex-wrap: wrap; gap: .6rem; padding: .7rem; border: 1px solid #dbe4ee; border-radius: 10px; }
        .question-evidence-row > div:first-child { display: grid; gap: .15rem; flex: 1 1 260px; }
        .question-evidence-row a { color: #1d4ed8; font-weight: 800; text-decoration: none; }
        .question-evidence-row small { color: #64748b; }
        .review-buttons { display: flex; gap: .4rem; flex-wrap: wrap; }
        .evidence-add-actions { display: flex; align-items: center; flex-wrap: wrap; gap: .6rem; }
        .evidence-add-actions form { display: grid; grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) auto; gap: .45rem; flex: 1 1 560px; }
        .question-card-v4 > footer { display: flex; justify-content: flex-end; gap: .5rem; }
        .link-dialog { width: min(620px, calc(100vw - 28px)); }
        .link-dialog header, .link-dialog footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid #e2e8f0; }
        .link-dialog footer { justify-content: flex-end; border-top: 1px solid #e2e8f0; border-bottom: 0; }
        .link-dialog h3, .link-dialog p { margin: .2rem 0; }
        .link-fields { display: grid; gap: .8rem; padding: 1rem 1.2rem; }
        @media (max-width: 850px) {
          .answer-grid { grid-template-columns: 1fr; }
          .evidence-add-actions form { grid-template-columns: 1fr; }
        }
      `}</style>
    </article>
  );
}
