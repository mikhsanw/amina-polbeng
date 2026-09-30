"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

type WorkflowAction = "SUBMIT" | "VALIDATE" | "RETURN" | "ACTIVATE";

const label = (value: unknown) =>
  String(value ?? "—").replaceAll("_", " ");
const hasRole = (user: any, ...roles: string[]) =>
  user.roles?.some((role: string) => roles.includes(role));

export function InstrumentReviewPanel({
  workspace,
  questions,
  user,
  myAssignment,
  busy,
  run,
}: {
  workspace: any;
  questions: any[];
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const [history, setHistory] = useState<any>({
    previousWorkspace: null,
    questions: [],
  });
  const [historyError, setHistoryError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [verifierDecision, setVerifierDecision] = useState("");
  const [verifierNote, setVerifierNote] = useState("");
  const [workflowAction, setWorkflowAction] =
    useState<WorkflowAction | null>(null);
  const [workflowNote, setWorkflowNote] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("ALL");

  useEffect(() => {
    api(`/audit-flow/workspaces/${workspace.id}/instrument/history`)
      .then(setHistory)
      .catch((reason: any) => setHistoryError(reason.message));
  }, [workspace.id]);

  const historyByMasterId = useMemo(
    () =>
      new Map(
        (history.questions || []).map((item: any) => [
          item.masterQuestionId,
          item,
        ]),
      ),
    [history],
  );

  const editableStatus = ["AUDITOR_REVIEW", "RETURNED", "DRAFT"].includes(
    workspace.instrumentStatus,
  );
  const canReview =
    ["AUDITOR", "LEAD_AUDITOR"].includes(myAssignment || "") &&
    editableStatus;
  const canSubmit = myAssignment === "LEAD_AUDITOR" && editableStatus;
  const isVerifier =
    myAssignment === "VERIFIER" &&
    workspace.instrumentStatus === "PENDING_VERIFICATION";
  const canActivate =
    hasRole(user, "SUPER_ADMIN", "ADMIN_MUTU") &&
    workspace.instrumentStatus === "APPROVED";

  const changedCount = questions.filter((question) => question.changeFlag).length;
  const reviewedCount = questions.filter(
    (question) => question.reviewedAt || question.reviewStatus === "APPROVED",
  ).length;
  const pendingCount = questions.filter(
    (question) => question.reviewStatus === "PENDING_VERIFICATION",
  ).length;
  const validCount = questions.filter(
    (question) => question.reviewStatus === "APPROVED",
  ).length;
  const invalidCount = questions.filter(
    (question) => question.reviewStatus === "RETURNED",
  ).length;
  const canValidate =
    isVerifier && questions.length > 0 && validCount === questions.length;
  const canReturn = isVerifier && pendingCount === 0 && invalidCount > 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (view === "CHANGED" && !question.changeFlag) return false;
      if (view === "UNREVIEWED" && question.reviewedAt) return false;
      if (view === "PENDING" && question.reviewStatus !== "PENDING_VERIFICATION") {
        return false;
      }
      if (view === "VALID" && question.reviewStatus !== "APPROVED") return false;
      if (view === "INVALID" && question.reviewStatus !== "RETURNED") return false;
      if (!query) return true;
      return [
        question.masterQuestion?.code,
        question.defaultQuestion,
        question.auditorQuestion,
        question.masterQuestion?.standard?.title,
        question.masterQuestion?.isoClause?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [questions, search, view]);

  function openQuestion(question: any) {
    setSelected(question);
    setDraft({
      question:
        question.auditorQuestion ??
        question.defaultQuestion ??
        question.questionSnapshot,
      expectedEvidence:
        question.auditorExpectedEvidence ?? question.defaultExpectedEvidence ?? "",
      testMethod:
        question.auditorTestMethod ?? question.defaultTestMethod ?? "",
      riskLevel:
        question.auditorRiskLevel ?? question.defaultRiskLevel ?? "MEDIUM",
      changeReason: question.changeReason ?? "",
      auditorNote: question.auditorNote ?? "",
      excluded: Boolean(question.excluded),
      exclusionReason:
        question.exclusionReason ?? question.changeReason ?? "",
    });
    setVerifierDecision(
      question.reviewStatus === "APPROVED"
        ? "VALID"
        : question.reviewStatus === "RETURNED"
          ? "INVALID"
          : "",
    );
    setVerifierNote(question.verifierNote ?? "");
  }

  async function saveQuestion() {
    if (!selected || !draft) return;
    if (draft.excluded) {
      const reason = String(
        draft.exclusionReason || draft.changeReason || "",
      ).trim();
      if (!reason) return;
      const saved = await run(
        `/audit-flow/questions/${selected.id}`,
        {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        },
        "Pertanyaan dikecualikan dari instrumen unit.",
      );
      if (saved) setSelected(null);
      return;
    }

    if (selected.excluded) {
      const included = await run(
        `/audit-flow/questions/${selected.id}/include`,
        { method: "POST", body: "{}" },
        "Pertanyaan disertakan kembali.",
      );
      if (!included) return;
    }

    const changed =
      String(draft.question).trim() !== String(selected.defaultQuestion).trim() ||
      String(draft.expectedEvidence ?? "").trim() !==
        String(selected.defaultExpectedEvidence ?? "").trim() ||
      String(draft.testMethod ?? "").trim() !==
        String(selected.defaultTestMethod ?? "").trim() ||
      String(draft.riskLevel ?? "").trim() !==
        String(selected.defaultRiskLevel ?? "").trim();

    if (changed && !String(draft.changeReason ?? "").trim()) return;

    const saved = await run(
      `/audit-flow/questions/${selected.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          question: draft.question,
          expectedEvidence: draft.expectedEvidence,
          testMethod: draft.testMethod,
          riskLevel: draft.riskLevel,
          changeReason: changed ? draft.changeReason : "",
          auditorNote: draft.auditorNote,
        }),
      },
      changed
        ? "Usulan perubahan instrumen disimpan."
        : "Telaah selesai tanpa perubahan.",
    );
    if (saved) setSelected(null);
  }

  async function saveVerifierDecision() {
    if (!selected || !verifierDecision) return;
    if (verifierDecision === "INVALID" && !verifierNote.trim()) return;
    const saved = await run(
      `/audit-flow/workspaces/${workspace.id}/instrument/questions/${selected.id}/verify`,
      {
        method: "POST",
        body: JSON.stringify({
          decision: verifierDecision,
          note: verifierNote.trim() || undefined,
        }),
      },
      verifierDecision === "VALID"
        ? "Butir dinyatakan valid."
        : "Butir dinyatakan tidak valid dan ditandai untuk dikembalikan.",
    );
    if (saved) setSelected(null);
  }

  function actionTitle(action: WorkflowAction) {
    if (action === "SUBMIT") return "Submit Perbaikan Instrumen";
    if (action === "VALIDATE") return "Validasi dan Kirim ke Admin Mutu";
    if (action === "RETURN") return "Kembalikan kepada Ketua Auditor";
    return "Aktifkan Instrumen untuk Self-Assessment";
  }

  async function executeWorkflowAction() {
    if (!workflowAction) return;
    const routes: Record<WorkflowAction, string> = {
      SUBMIT: `/audit-flow/workspaces/${workspace.id}/instrument/submit-review`,
      VALIDATE: `/audit-flow/workspaces/${workspace.id}/instrument/validate`,
      RETURN: `/audit-flow/workspaces/${workspace.id}/instrument/return-review`,
      ACTIVATE: `/audit-flow/workspaces/${workspace.id}/instrument/activate`,
    };
    const messages: Record<WorkflowAction, string> = {
      SUBMIT: "Hasil telaah dikirim kepada Verifikator P4MP.",
      VALIDATE: "Seluruh butir valid dan dikirim kepada Admin Mutu.",
      RETURN: "Butir tidak valid dikembalikan kepada Ketua Auditor.",
      ACTIVATE: "Instrumen diaktifkan dan self-assessment dibuka untuk Auditee.",
    };
    if (workflowAction === "RETURN" && !workflowNote.trim()) return;
    const success = await run(
      routes[workflowAction],
      {
        method: "POST",
        body: JSON.stringify({ note: workflowNote.trim() || undefined }),
      },
      messages[workflowAction],
    );
    if (success) {
      setWorkflowAction(null);
      setWorkflowNote("");
    }
  }

  const selectedHistory = selected
    ? historyByMasterId.get(selected.masterQuestionId)
    : null;

  return (
    <section className="ami-panel instrument-review-panel">
      <div className="ami-panel-title instrument-review-heading">
        <div>
          <h2>Telaah dan Validasi Instrumen Audit</h2>
          <p>
            Auditor menelaah setiap butir. Verifikator menetapkan Valid atau Tidak
            Valid pada setiap butir sebelum keputusan akhir.
          </p>
        </div>
        <div className="instrument-status-summary">
          <span>{reviewedCount}/{questions.length} ditelaah</span>
          <span>{changedCount} berubah</span>
          {workspace.instrumentStatus === "PENDING_VERIFICATION" && (
            <>
              <span>{pendingCount} belum diverifikasi</span>
              <span>{validCount} valid</span>
              <span>{invalidCount} tidak valid</span>
            </>
          )}
        </div>
      </div>

      <div className="instrument-workflow-banner">
        {workspace.instrumentStatus === "PENDING_VERIFICATION" && (
          <b>
            Verifikator wajib memeriksa seluruh butir. Kembalikan hanya bila ada
            butir tidak valid.
          </b>
        )}
        {workspace.instrumentStatus === "APPROVED" && (
          <b>Seluruh butir valid. Menunggu aktivasi Admin Mutu.</b>
        )}
        {["AUDITOR_REVIEW", "RETURNED", "DRAFT"].includes(
          workspace.instrumentStatus,
        ) && (
          <b>
            Telaah berjalan. Hanya Ketua Auditor penugasan unit ini yang dapat
            mengirim hasilnya.
          </b>
        )}
        {workspace.instrumentStatus === "PUBLISHED" && (
          <b>Instrumen aktif dan telah dibuka untuk self-assessment Auditee.</b>
        )}
      </div>

      <div className="instrument-toolbar-review">
        <input
          placeholder="Cari kode, pertanyaan, standar, atau klausul…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={view} onChange={(event) => setView(event.target.value)}>
          <option value="ALL">Semua butir</option>
          <option value="CHANGED">Hanya yang berubah</option>
          {isVerifier ? (
            <>
              <option value="PENDING">Belum diverifikasi</option>
              <option value="VALID">Valid</option>
              <option value="INVALID">Tidak valid</option>
            </>
          ) : (
            <option value="UNREVIEWED">Belum ditelaah</option>
          )}
        </select>
      </div>

      <div className="ami-actions instrument-workflow-actions">
        {canSubmit && (
          <button
            className="primary"
            disabled={busy || !questions.length || reviewedCount < questions.length}
            onClick={() => setWorkflowAction("SUBMIT")}
          >
            Submit Perbaikan Instrumen
          </button>
        )}
        {canSubmit && reviewedCount < questions.length && (
          <span className="muted">
            Telaah {questions.length - reviewedCount} butir lagi sebelum submit.
          </span>
        )}
        {isVerifier && (
          <>
            <button
              className="primary"
              disabled={busy || !canValidate}
              onClick={() => setWorkflowAction("VALIDATE")}
            >
              Validasi dan Kirim ke Admin Mutu
            </button>
            <button
              disabled={busy || !canReturn}
              onClick={() => setWorkflowAction("RETURN")}
            >
              Kembalikan ke Ketua Auditor
            </button>
          </>
        )}
        {canActivate && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => setWorkflowAction("ACTIVATE")}
          >
            Aktifkan untuk Self-Assessment
          </button>
        )}
      </div>

      {historyError && <div className="warning">{historyError}</div>}

      <div className="ami-question-list">
        {filtered.map((question: any) => {
          const previous = historyByMasterId.get(question.masterQuestionId) as
            | any
            | undefined;
          return (
            <article
              key={question.id}
              className={`ami-question ${question.changeFlag ? "changed" : ""}`}
            >
              <header>
                <div>
                  <small>
                    {question.masterQuestion?.code} · {label(question.dimension)}
                  </small>
                  <b>
                    {question.auditorQuestion ||
                      question.defaultQuestion ||
                      question.questionSnapshot}
                  </b>
                </div>
                <span className="ami-pill">{label(question.reviewStatus)}</span>
              </header>
              <div className="instrument-card-meta">
                <span>
                  {question.masterQuestion?.standard?.title || "Tanpa standar"}
                </span>
                <span>ISO {question.masterQuestion?.isoClause?.code || "—"}</span>
                <span>
                  {previous
                    ? `Ada riwayat ${history.previousWorkspace?.auditYear}`
                    : "Belum ada riwayat tahun lalu"}
                </span>
              </div>
              {question.changeFlag && (
                <div className="ami-comparison compact-comparison">
                  <div>
                    <label>Default</label>
                    <p>{question.defaultQuestion}</p>
                  </div>
                  <div>
                    <label>Usulan Auditor</label>
                    <p>
                      {question.excluded
                        ? "DIKECUALIKAN"
                        : question.auditorQuestion || "—"}
                    </p>
                    <small>{question.changeReason}</small>
                  </div>
                </div>
              )}
              {question.verifierNote && (
                <div className="warning-box">
                  <b>Catatan Verifikator</b>
                  <span>{question.verifierNote}</span>
                </div>
              )}
              <footer>
                <span>
                  {question.reviewedAt
                    ? `Ditelaah ${new Date(question.reviewedAt).toLocaleDateString(
                        "id-ID",
                      )}`
                    : "Belum ditelaah"}
                </span>
                <button className="small" onClick={() => openQuestion(question)}>
                  {canReview
                    ? "Buka Telaah"
                    : isVerifier
                      ? "Periksa & Putuskan"
                      : "Lihat Detail"}
                </button>
              </footer>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="empty">Tidak ada butir sesuai filter.</div>
        )}
      </div>

      {selected && draft && (
        <div
          className="ami-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Telaah instrumen"
        >
          <div className="ami-dialog ami-instrument-dialog">
            <div className="instrument-dialog-header">
              <div>
                <small>{selected.masterQuestion?.code}</small>
                <h3>{isVerifier ? "Validasi Butir Instrumen" : "Telaah Instrumen"}</h3>
                <p>{workspace.unit.name}</p>
              </div>
              <button className="dialog-close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>

            <div className="instrument-dialog-grid">
              <section className="instrument-reference-column">
                <div className="reference-box">
                  <label>Rumusan default</label>
                  <p>{selected.defaultQuestion}</p>
                </div>
                <div className="reference-box">
                  <label>Jawaban tahun sebelumnya</label>
                  {selectedHistory ? (
                    <>
                      <small>
                        Audit {history.previousWorkspace?.auditYear} ·{" "}
                        {history.previousWorkspace?.name}
                      </small>
                      <p>{selectedHistory.question || "—"}</p>
                      <dl className="history-answer">
                        <dt>Jawaban Auditee</dt>
                        <dd>{selectedHistory.response || "Belum ada jawaban"}</dd>
                        <dt>Hasil Auditor</dt>
                        <dd>
                          {label(
                            selectedHistory.standardResult ||
                              selectedHistory.processResult,
                          )}
                        </dd>
                        <dt>Ringkasan bukti</dt>
                        <dd>{selectedHistory.evidenceSummary || "—"}</dd>
                      </dl>
                    </>
                  ) : (
                    <p>Belum ada rekaman audit tahun sebelumnya untuk butir ini.</p>
                  )}
                </div>
              </section>

              <section className="instrument-edit-column">
                <label>
                  Rumusan hasil telaah Auditor
                  <textarea
                    rows={5}
                    disabled={!canReview}
                    value={draft.question}
                    onChange={(event) =>
                      setDraft({ ...draft, question: event.target.value })
                    }
                  />
                </label>
                <label>
                  Bukti yang diharapkan
                  <textarea
                    rows={3}
                    disabled={!canReview}
                    value={draft.expectedEvidence}
                    onChange={(event) =>
                      setDraft({ ...draft, expectedEvidence: event.target.value })
                    }
                  />
                </label>
                <label>
                  Metode pengujian
                  <textarea
                    rows={3}
                    disabled={!canReview}
                    value={draft.testMethod}
                    onChange={(event) =>
                      setDraft({ ...draft, testMethod: event.target.value })
                    }
                  />
                </label>
                <div className="instrument-small-grid">
                  <label>
                    Risiko
                    <select
                      disabled={!canReview}
                      value={draft.riskLevel}
                      onChange={(event) =>
                        setDraft({ ...draft, riskLevel: event.target.value })
                      }
                    >
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((risk) => (
                        <option key={risk}>{risk}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Alasan perubahan
                  <textarea
                    rows={3}
                    disabled={!canReview}
                    value={draft.changeReason}
                    onChange={(event) =>
                      setDraft({ ...draft, changeReason: event.target.value })
                    }
                    placeholder="Wajib bila rumusan, bukti, metode, atau risiko berubah."
                  />
                </label>
                <label>
                  Catatan Auditor
                  <textarea
                    rows={2}
                    disabled={!canReview}
                    value={draft.auditorNote}
                    onChange={(event) =>
                      setDraft({ ...draft, auditorNote: event.target.value })
                    }
                  />
                </label>
                {canReview && (
                  <label className="instrument-exclude-check">
                    <input
                      type="checkbox"
                      checked={draft.excluded}
                      onChange={(event) =>
                        setDraft({ ...draft, excluded: event.target.checked })
                      }
                    />
                    Kecualikan pertanyaan dari instrumen unit ini
                  </label>
                )}
                {draft.excluded && (
                  <label>
                    Alasan pengecualian
                    <textarea
                      rows={2}
                      disabled={!canReview}
                      value={draft.exclusionReason}
                      onChange={(event) =>
                        setDraft({ ...draft, exclusionReason: event.target.value })
                      }
                    />
                  </label>
                )}

                {isVerifier && selected.reviewStatus === "PENDING_VERIFICATION" && (
                  <div className="verifier-decision-box">
                    <h4>Keputusan Verifikator</h4>
                    <div className="decision-options">
                      <label>
                        <input
                          type="radio"
                          name="verifier-decision"
                          value="VALID"
                          checked={verifierDecision === "VALID"}
                          onChange={(event) =>
                            setVerifierDecision(event.target.value)
                          }
                        />
                        Valid
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="verifier-decision"
                          value="INVALID"
                          checked={verifierDecision === "INVALID"}
                          onChange={(event) =>
                            setVerifierDecision(event.target.value)
                          }
                        />
                        Tidak Valid
                      </label>
                    </div>
                    <label>
                      Catatan verifikasi
                      <textarea
                        rows={3}
                        required={verifierDecision === "INVALID"}
                        value={verifierNote}
                        onChange={(event) => setVerifierNote(event.target.value)}
                        placeholder="Wajib diisi jika Tidak Valid."
                      />
                    </label>
                  </div>
                )}
              </section>
            </div>

            <div className="ami-dialog-actions">
              <button onClick={() => setSelected(null)}>Tutup</button>
              {canReview && selected.reviewStatus !== "APPROVED" && (
                <button className="primary" disabled={busy} onClick={saveQuestion}>
                  Simpan Hasil Telaah
                </button>
              )}
              {isVerifier && selected.reviewStatus === "PENDING_VERIFICATION" && (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !verifierDecision ||
                    (verifierDecision === "INVALID" && !verifierNote.trim())
                  }
                  onClick={saveVerifierDecision}
                >
                  Simpan Keputusan Butir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {workflowAction && (
        <div
          className="ami-modal"
          role="dialog"
          aria-modal="true"
          aria-label={actionTitle(workflowAction)}
        >
          <div className="ami-dialog workflow-confirm-dialog">
            <h3>{actionTitle(workflowAction)}</h3>
            {workflowAction === "SUBMIT" && (
              <p>
                Seluruh {questions.length} butir telah ditelaah dan akan dikirim
                kepada Verifikator P4MP. Terdapat {changedCount} butir perubahan.
              </p>
            )}
            {workflowAction === "VALIDATE" && (
              <p>
                Seluruh {validCount} butir dinyatakan valid dan akan dikirim kepada
                Admin Mutu untuk diaktifkan.
              </p>
            )}
            {workflowAction === "RETURN" && (
              <p>
                {invalidCount} butir tidak valid akan dikembalikan kepada Ketua
                Auditor. Butir yang sudah valid tetap terkunci.
              </p>
            )}
            {workflowAction === "ACTIVATE" && (
              <p>
                Instrumen akan dipublikasikan dan self-assessment dibuka untuk
                Auditee unit {workspace.unit.name}.
              </p>
            )}
            <label>
              {workflowAction === "RETURN"
                ? "Catatan pengembalian"
                : "Catatan proses"}
              <textarea
                rows={4}
                required={workflowAction === "RETURN"}
                value={workflowNote}
                onChange={(event) => setWorkflowNote(event.target.value)}
              />
            </label>
            <div className="ami-dialog-actions">
              <button
                onClick={() => {
                  setWorkflowAction(null);
                  setWorkflowNote("");
                }}
              >
                Batal
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  (workflowAction === "RETURN" && !workflowNote.trim())
                }
                onClick={executeWorkflowAction}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
