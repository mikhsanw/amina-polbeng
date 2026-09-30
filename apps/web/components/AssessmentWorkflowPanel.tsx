"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const hasRole = (user: any, ...roles: string[]) =>
  user.roles?.some((role: string) => roles.includes(role));
const label = (value: unknown) =>
  String(value ?? "—").replaceAll("_", " ");
const resultLabel = (value: unknown) => {
  const text = String(value ?? "—");
  if (text === "BELUM_DIUKUR") return "TIDAK DIUKUR";
  if (text === "KTS_MINOR") return "KTS/NC MINOR";
  if (text === "KTS_MAYOR") return "KTS/NC MAYOR";
  return text.replaceAll("_", " ");
};

const STANDARD_RESULTS = [
  ["MELAMPAUI", "Melampaui"],
  ["TERCAPAI", "Tercapai"],
  ["TIDAK_TERCAPAI", "Tidak Tercapai"],
  ["BELUM_DIUKUR", "Tidak Diukur"],
];
const PROCESS_RESULTS = [
  ["C", "C · Sesuai"],
  ["OFI", "OFI · Peluang Perbaikan"],
  ["OBS", "OBS · Observasi"],
  ["KTS_MINOR", "KTS/NC Minor"],
  ["KTS_MAYOR", "KTS/NC Mayor"],
  ["GP", "GP · Praktik Baik"],
  ["NA", "NA · Tidak Berlaku"],
];

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export function AssessmentWorkflowPanel({
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
  const [selected, setSelected] = useState<any>(null);
  const [reviewDecision, setReviewDecision] = useState("ACCEPT");
  const [reviewNote, setReviewNote] = useState("");
  const [fieldDraft, setFieldDraft] = useState<any>({
    action: "CLOSE",
    findingType: "KTS_MINOR",
  });

  const load = async () => {
    try {
      setData(
        await api(`/audit-flow/workspaces/${workspace.id}/assessment-flow`),
      );
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Gagal memuat assessment.");
    }
  };

  useEffect(() => {
    load();
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
  const schedule = data?.schedule;
  const isAuditee =
    hasRole(user, "AUDITEE") && workspace.unitId === user.unitId;
  const isAuditor = ["AUDITOR", "LEAD_AUDITOR"].includes(
    myAssignment || "",
  );
  const isLead = myAssignment === "LEAD_AUDITOR";

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const question of questions) {
      const status = question.assessment?.responseStatus || "NOT_STARTED";
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [questions]);

  const pendingEvidence = evidences.filter(
    (item: any) => item.reviewStatus === "PENDING",
  ).length;
  const deskReady =
    questions.length > 0 &&
    questions.every((question: any) =>
      ["APPROVED", "RETURNED"].includes(
        question.assessment?.responseStatus || "",
      ),
    ) &&
    pendingEvidence === 0;
  const fieldComplete =
    questions.length > 0 &&
    questions.every((question: any) =>
      ["APPROVED", "OPEN"].includes(
        question.assessment?.responseStatus || "",
      ),
    );

  function openReview(question: any) {
    setSelected(question);
    setReviewDecision("ACCEPT");
    setReviewNote(question.assessment?.returnNote || "");
    setFieldDraft({
      action:
        question.assessment?.responseStatus === "OPEN" ? "OPEN" : "CLOSE",
      standardResult:
        question.assessment?.standardResult === "BELUM_DIUKUR"
          ? "BELUM_DIKERJAKAN"
          : question.assessment?.standardResult || "TERCAPAI",
      processResult: question.assessment?.processResult || "C",
      note: question.assessment?.returnNote || "",
      findingType: "KTS_MINOR",
      dueDate: question.findings?.find((item: any) => item.status === "OPEN")
        ?.dueDate?.slice?.(0, 10) || "",
      condition: "",
      objectiveEvidence: "",
      gapStatement: "",
      riskImpact: "",
    });
  }

  async function submitReview() {
    if (!selected?.assessment) return;
    if (reviewDecision === "RETURN" && !reviewNote.trim()) return;
    const ok = await perform(
      `/audit-flow/assessments/${selected.assessment.id}/auditor-review`,
      {
        method: "POST",
        body: JSON.stringify({
          decision: reviewDecision,
          note: reviewNote.trim() || undefined,
        }),
      },
      reviewDecision === "ACCEPT"
        ? "Jawaban dan bukti diterima Auditor."
        : "Jawaban dikembalikan kepada Auditee.",
    );
    if (ok) setSelected(null);
  }

  async function submitFieldDecision() {
    if (!selected?.assessment) return;
    if (!String(fieldDraft.note || "").trim()) return;
    if (fieldDraft.action === "OPEN" && !fieldDraft.dueDate) return;
    const ok = await perform(
      `/audit-flow/assessments/${selected.assessment.id}/field-decision`,
      {
        method: "POST",
        body: JSON.stringify(fieldDraft),
      },
      fieldDraft.action === "OPEN"
        ? "Butir ditetapkan Open dan masuk pemantauan temuan."
        : "Butir diselesaikan pada assessment lapangan.",
    );
    if (ok) setSelected(null);
  }

  if (!data) {
    return <section className="ami-panel"><div className="empty">Memuat self-assessment…</div></section>;
  }

  return (
    <section className="ami-panel assessment-workflow-panel">
      <div className="ami-panel-title">
        <div>
          <h2>Self-Assessment dan Assessment Lapangan</h2>
          <p>
            Auditee melengkapi jawaban dan bukti. Auditor menetapkan hasil audit
            setelah pemeriksaan.
          </p>
        </div>
        <div className="assessment-summary">
          <span>{questions.length} pertanyaan</span>
          <span>{statusCounts.SUBMITTED || 0} menunggu pemeriksaan</span>
          <span>{statusCounts.RETURNED || 0} dikembalikan</span>
          <span>{statusCounts.OPEN || 0} open</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="phase-schedule-strip">
        <div>
          <small>SELF-ASSESSMENT</small>
          <b>{formatDate(schedule?.selfAssessmentStart)} s.d. {formatDate(schedule?.selfAssessmentEnd)}</b>
        </div>
        <div>
          <small>PEMERIKSAAN AUDITOR</small>
          <b>{formatDate(schedule?.selfAssessmentReviewStart)} s.d. {formatDate(schedule?.selfAssessmentReviewEnd)}</b>
        </div>
        <div>
          <small>ASSESSMENT LAPANGAN</small>
          <b>{formatDate(schedule?.fieldAuditStart)} s.d. {formatDate(schedule?.fieldAuditEnd)}</b>
        </div>
      </div>

      <div className="ami-actions assessment-stage-actions">
        {isAuditee && workspace.status === "SELF_ASSESSMENT" && (
          <button
            className="primary"
            disabled={busy || !questions.length}
            onClick={() =>
              perform(
                `/audit-flow/workspaces/${workspace.id}/assessments/submit-auditee`,
                { method: "POST", body: "{}" },
                "Seluruh self-assessment dikirim kepada Auditor.",
              )
            }
          >
            Submit Seluruh Self-Assessment
          </button>
        )}
        {isLead && workspace.status === "DESK_REVIEW" && (
          <button
            className="primary"
            disabled={busy || !deskReady}
            onClick={() =>
              perform(
                `/audit-flow/workspaces/${workspace.id}/field-audit/open`,
                { method: "POST", body: "{}" },
                "Assessment lapangan dibuka.",
              )
            }
          >
            Buka Assessment Lapangan
          </button>
        )}
        {isLead && workspace.status === "DESK_REVIEW" && !deskReady && (
          <span className="muted">
            Selesaikan pemeriksaan semua jawaban dan {pendingEvidence} bukti pending.
          </span>
        )}
        {isLead && workspace.status === "FIELD_AUDIT" && (
          <button
            className="primary"
            disabled={busy || !fieldComplete}
            onClick={() =>
              perform(
                `/audit-flow/workspaces/${workspace.id}/field-audit/complete`,
                { method: "POST", body: "{}" },
                "Assessment lapangan selesai dan masuk tahap laporan.",
              )
            }
          >
            Selesaikan Assessment Lapangan
          </button>
        )}
      </div>

      <div className="assessment-question-list">
        {questions.map((question: any) => (
          <AssessmentQuestionCard
            key={question.id}
            question={question}
            workspace={workspace}
            user={user}
            isAuditee={isAuditee}
            isAuditor={isAuditor}
            busy={busy}
            onReload={load}
            perform={perform}
            onReview={() => openReview(question)}
          />
        ))}
        {!questions.length && (
          <div className="empty">Instrumen belum aktif untuk self-assessment.</div>
        )}
      </div>

      {selected && (
        <div className="ami-modal" role="dialog" aria-modal="true">
          <div className="ami-dialog assessment-review-dialog">
            <div className="instrument-dialog-header">
              <div>
                <small>{selected.masterQuestion?.code}</small>
                <h3>
                  {workspace.status === "FIELD_AUDIT"
                    ? "Keputusan Assessment Lapangan"
                    : "Pemeriksaan Self-Assessment"}
                </h3>
                <p>{selected.publishedQuestion || selected.questionSnapshot}</p>
              </div>
              <button className="dialog-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="assessment-review-body">
              <section>
                <h4>Jawaban Auditee</h4>
                <p>{selected.assessment?.implementationDescription || "—"}</p>
                <h4>Ringkasan bukti</h4>
                <p>{selected.assessment?.evidenceSummary || "—"}</p>
                <h4>Kendala</h4>
                <p>{selected.assessment?.constraintNote || "—"}</p>
                <h4>Bukti yang diminta</h4>
                <p>{selected.publishedExpectedEvidence || selected.defaultExpectedEvidence || "—"}</p>
              </section>

              {workspace.status === "DESK_REVIEW" ? (
                <section className="review-decision-form">
                  <h4>Keputusan pemeriksaan</h4>
                  <label>
                    <input
                      type="radio"
                      name="assessment-review"
                      checked={reviewDecision === "ACCEPT"}
                      onChange={() => setReviewDecision("ACCEPT")}
                    />
                    Diterima untuk assessment lapangan
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="assessment-review"
                      checked={reviewDecision === "RETURN"}
                      onChange={() => setReviewDecision("RETURN")}
                    />
                    Dikembalikan untuk perbaikan
                  </label>
                  <label>
                    Catatan Auditor
                    <textarea
                      rows={4}
                      required={reviewDecision === "RETURN"}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </label>
                </section>
              ) : (
                <section className="field-decision-form">
                  <label>
                    Hasil audit
                    {selected.dimension === "STANDARD_ACHIEVEMENT" ? (
                      <select
                        value={fieldDraft.standardResult}
                        onChange={(event) =>
                          setFieldDraft({ ...fieldDraft, standardResult: event.target.value })
                        }
                      >
                        {STANDARD_RESULTS.map(([value, name]) => (
                          <option key={value} value={value}>{name}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={fieldDraft.processResult}
                        onChange={(event) =>
                          setFieldDraft({ ...fieldDraft, processResult: event.target.value })
                        }
                      >
                        {PROCESS_RESULTS.map(([value, name]) => (
                          <option key={value} value={value}>{name}</option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label>
                    Status butir
                    <select
                      value={fieldDraft.action}
                      onChange={(event) =>
                        setFieldDraft({ ...fieldDraft, action: event.target.value })
                      }
                    >
                      <option value="CLOSE">Selesai</option>
                      <option value="OPEN">Open · perlu perbaikan</option>
                    </select>
                  </label>
                  <label>
                    Catatan hasil lapangan
                    <textarea
                      rows={4}
                      value={fieldDraft.note || ""}
                      onChange={(event) =>
                        setFieldDraft({ ...fieldDraft, note: event.target.value })
                      }
                    />
                  </label>
                  {fieldDraft.action === "OPEN" && (
                    <div className="open-finding-fields">
                      <label>
                        Batas perbaikan
                        <input
                          type="date"
                          value={fieldDraft.dueDate || ""}
                          onChange={(event) =>
                            setFieldDraft({ ...fieldDraft, dueDate: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Jenis
                        <select
                          value={fieldDraft.findingType}
                          onChange={(event) =>
                            setFieldDraft({ ...fieldDraft, findingType: event.target.value })
                          }
                        >
                          <option value="OBS">OBS</option>
                          <option value="OFI">OFI</option>
                          <option value="KTS_MINOR">KTS/NC Minor</option>
                          <option value="KTS_MAYOR">KTS/NC Mayor</option>
                        </select>
                      </label>
                      <label>
                        Kondisi
                        <textarea
                          rows={2}
                          value={fieldDraft.condition || ""}
                          onChange={(event) =>
                            setFieldDraft({ ...fieldDraft, condition: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Bukti objektif
                        <textarea
                          rows={2}
                          value={fieldDraft.objectiveEvidence || ""}
                          onChange={(event) =>
                            setFieldDraft({ ...fieldDraft, objectiveEvidence: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Kesenjangan
                        <textarea
                          rows={2}
                          value={fieldDraft.gapStatement || ""}
                          onChange={(event) =>
                            setFieldDraft({ ...fieldDraft, gapStatement: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Dampak risiko
                        <textarea
                          rows={2}
                          value={fieldDraft.riskImpact || ""}
                          onChange={(event) =>
                            setFieldDraft({ ...fieldDraft, riskImpact: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="ami-dialog-actions">
              <button onClick={() => setSelected(null)}>Batal</button>
              {workspace.status === "DESK_REVIEW" ? (
                <button
                  className="primary"
                  disabled={busy || (reviewDecision === "RETURN" && !reviewNote.trim())}
                  onClick={submitReview}
                >
                  Simpan Keputusan
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !String(fieldDraft.note || "").trim() ||
                    (fieldDraft.action === "OPEN" && !fieldDraft.dueDate)
                  }
                  onClick={submitFieldDecision}
                >
                  Simpan Hasil Lapangan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AssessmentQuestionCard({
  question,
  workspace,
  user,
  isAuditee,
  isAuditor,
  busy,
  perform,
  onReload,
  onReview,
}: {
  question: any;
  workspace: any;
  user: any;
  isAuditee: boolean;
  isAuditor: boolean;
  busy: boolean;
  perform: RunAction;
  onReload: () => Promise<void>;
  onReview: () => void;
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
      ["NOT_STARTED", "IN_PROGRESS", "RETURNED"].includes(
        assessment.responseStatus || "NOT_STARTED",
      )) ||
      (workspace.status === "FIELD_AUDIT" &&
        ["RETURNED", "OPEN", "IN_PROGRESS"].includes(
          assessment.responseStatus || "",
        )));
  const auditorReviewable =
    isAuditor &&
    workspace.status === "DESK_REVIEW" &&
    assessment.responseStatus === "SUBMITTED";
  const fieldReviewable =
    isAuditor && workspace.status === "FIELD_AUDIT";

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
      await onReload();
    } finally {
      setUploading(false);
    }
  }

  return (
    <article className={`assessment-question-card status-${String(assessment.responseStatus || "NOT_STARTED").toLowerCase()}`}>
      <header>
        <div>
          <small>
            {question.masterQuestion?.code} · {label(question.dimension)}
          </small>
          <h3>{question.publishedQuestion || question.questionSnapshot}</h3>
          <div className="question-classification">
            <span>{question.masterQuestion?.standard?.title || "Tanpa standar"}</span>
            <span>ISO {question.masterQuestion?.isoClause?.code || "—"}</span>
          </div>
        </div>
        <span className="ami-pill">{label(assessment.responseStatus || "NOT_STARTED")}</span>
      </header>

      <div className="expected-evidence-box">
        <b>Bukti yang harus disiapkan</b>
        <p>{question.publishedExpectedEvidence || question.defaultExpectedEvidence || "Tidak ditentukan secara khusus."}</p>
      </div>

      {isAuditee && (
        <div className="auditee-answer-form">
          <label>
            Uraian kondisi/pelaksanaan
            <textarea
              rows={4}
              disabled={!auditeeEditable}
              value={draft.implementationDescription}
              onChange={(event) =>
                setDraft({ ...draft, implementationDescription: event.target.value })
              }
            />
          </label>
          <label>
            Keterangan bukti
            <textarea
              rows={2}
              disabled={!auditeeEditable}
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
              disabled={!auditeeEditable}
              value={draft.constraintNote}
              onChange={(event) =>
                setDraft({ ...draft, constraintNote: event.target.value })
              }
            />
          </label>
          {auditeeEditable && (
            <div className="ami-actions">
              <button
                className="small primary"
                disabled={busy}
                onClick={() =>
                  perform(
                    `/audit-flow/assessments/${assessment.id}/auditee`,
                    { method: "PATCH", body: JSON.stringify(draft) },
                    "Jawaban Auditee disimpan.",
                  )
                }
              >
                Simpan Jawaban
              </button>
            </div>
          )}
        </div>
      )}

      <div className="question-evidence-list">
        <b>Bukti terunggah</b>
        {(question.evidences || []).length ? (
          question.evidences.map((evidence: any) => (
            <div className="question-evidence-row" key={evidence.id}>
              <span>{evidence.title}<small>{evidence.fileName}</small></span>
              <span className={`evidence-status ${String(evidence.reviewStatus).toLowerCase()}`}>
                {label(evidence.reviewStatus)}
              </span>
              {isAuditor && workspace.status === "DESK_REVIEW" && evidence.reviewStatus === "PENDING" && (
                <div className="ami-actions">
                  <button
                    className="small"
                    onClick={() =>
                      perform(
                        `/audit-flow/assessment-evidences/${evidence.id}/review`,
                        { method: "PATCH", body: JSON.stringify({ decision: "VALID", note: "Bukti sesuai." }) },
                        "Bukti dinyatakan valid.",
                      )
                    }
                  >
                    Valid
                  </button>
                  <button
                    className="small danger"
                    onClick={() => {
                      const note = window.prompt("Alasan bukti tidak valid");
                      if (note)
                        perform(
                          `/audit-flow/assessment-evidences/${evidence.id}/review`,
                          { method: "PATCH", body: JSON.stringify({ decision: "INVALID", note }) },
                          "Bukti dinyatakan tidak valid.",
                        );
                    }}
                  >
                    Tidak Valid
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <span className="muted">Belum ada bukti.</span>
        )}
      </div>

      {auditeeEditable && (
        <form className="question-upload-form" onSubmit={upload}>
          <input
            placeholder="Judul bukti"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            type="file"
            required
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <button className="small" disabled={uploading || !file}>
            {uploading ? "Mengunggah…" : "Unggah Bukti"}
          </button>
        </form>
      )}

      {(assessment.standardResult || assessment.processResult) && (
        <div className="auditor-result-box">
          <b>Hasil Auditor</b>
          <span>{resultLabel(assessment.standardResult || assessment.processResult)}</span>
        </div>
      )}
      {assessment.returnNote && (
        <div className="warning-box"><b>Catatan Auditor</b><span>{assessment.returnNote}</span></div>
      )}

      {(auditorReviewable || fieldReviewable) && (
        <footer>
          <button className="small primary" onClick={onReview}>
            {workspace.status === "FIELD_AUDIT"
              ? "Tetapkan Hasil Lapangan"
              : "Periksa Jawaban & Bukti"}
          </button>
        </footer>
      )}
    </article>
  );
}
