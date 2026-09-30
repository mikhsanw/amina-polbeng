"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AssessmentWorkflowPanel as ExistingAssessmentWorkflowPanel } from "./AssessmentWorkflowPanel";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const STANDARD_RESULTS = [
  ["MELAMPAUI", "Melampaui"],
  ["TERCAPAI", "Tercapai"],
  ["TIDAK_TERCAPAI", "Tidak Tercapai"],
  ["BELUM_DIUKUR", "Belum Diukur"],
];

const ISO_RESULTS = [
  ["C", "C · Sesuai"],
  ["OBS", "OBS · Observasi"],
  ["KTS_MINOR", "KTS/NC Minor"],
  ["KTS_MAYOR", "KTS/NC Mayor"],
  ["NA", "NA · Menjadi Temuan"],
];

const FINDING_TYPES = [
  ["OBS", "OBS"],
  ["KTS_MINOR", "KTS/NC Minor"],
  ["KTS_MAYOR", "KTS/NC Mayor"],
];

const isIsoQuestion = (question: any) =>
  Boolean(question?.masterQuestion?.isoClause) ||
  question?.masterQuestion?.criterionSource === "ISO_9001";

const requiresFinding = (question: any, draft: any) =>
  isIsoQuestion(question)
    ? ["OBS", "KTS_MINOR", "KTS_MAYOR", "NA"].includes(
        String(draft.processResult || ""),
      )
    : ["TIDAK_TERCAPAI", "BELUM_DIUKUR"].includes(
        String(draft.standardResult || ""),
      );

const resultLabel = (value: unknown) => {
  const text = String(value || "—");
  if (text === "BELUM_DIUKUR") return "BELUM DIUKUR";
  if (text === "KTS_MINOR") return "KTS/NC MINOR";
  if (text === "KTS_MAYOR") return "KTS/NC MAYOR";
  return text.replaceAll("_", " ");
};

export function AssessmentWorkflowPanel(props: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const { workspace, myAssignment } = props;
  const isAssignedAuditor = ["AUDITOR", "LEAD_AUDITOR"].includes(
    myAssignment || "",
  );

  if (workspace.status !== "FIELD_AUDIT" || !isAssignedAuditor) {
    return <ExistingAssessmentWorkflowPanel {...props} />;
  }

  return <AuditorFieldAuditPanel {...props} />;
}

function AuditorFieldAuditPanel({
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
  const [selected, setSelected] = useState<any>(null);
  const [draft, setDraft] = useState<any>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setData(await api(`/audit-flow/workspaces/${workspace.id}/assessment-flow`));
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Assessment lapangan gagal dimuat.");
    }
  };

  useEffect(() => {
    load();
  }, [workspace.id]);

  const questions = data?.questions || [];
  const completed = useMemo(
    () =>
      questions.filter((question: any) =>
        ["APPROVED", "OPEN"].includes(
          question.assessment?.responseStatus || "",
        ),
      ).length,
    [questions],
  );
  const allCompleted = questions.length > 0 && completed === questions.length;
  const isLead = myAssignment === "LEAD_AUDITOR";

  function openDecision(question: any) {
    const finding = question.findings?.find(
      (item: any) => item.status === "OPEN",
    );
    const iso = isIsoQuestion(question);
    const processResult = question.assessment?.processResult || "C";
    const savedWorkpaper =
      question.workpapers?.find(
        (item: any) => item.auditorUserId === user.id,
      ) || question.workpapers?.[0];
    setSelected(question);
    setDraft({
      standardResult: question.assessment?.standardResult || "TERCAPAI",
      processResult,
      note: question.assessment?.returnNote || "",
      sampleDescription: savedWorkpaper?.sampleDescription || "",
      interviewee: savedWorkpaper?.interviewee || "",
      objectiveEvidence:
        savedWorkpaper?.objectiveEvidence || finding?.objectiveEvidence || "",
      auditorAnalysis: savedWorkpaper?.auditorAnalysis || "",
      findingType:
        finding?.findingType || (processResult === "NA" ? "OBS" : "KTS_MINOR"),
      dueDate: finding?.dueDate?.slice?.(0, 10) || "",
      condition: finding?.condition || "",
      gapStatement: finding?.gapStatement || "",
      riskImpact: finding?.riskImpact || "",
      sourceType: iso ? "ISO" : "SPMI",
    });
  }

  async function saveDecision() {
    if (!selected?.assessment) return;
    const finding = requiresFinding(selected, draft);
    if (!String(draft.note || "").trim()) {
      setError("Catatan hasil lapangan wajib diisi.");
      return;
    }
    if (!String(draft.objectiveEvidence || "").trim()) {
      setError("Bukti objektif wajib diisi sebagai bagian kertas kerja.");
      return;
    }
    if (!String(draft.auditorAnalysis || "").trim()) {
      setError("Analisis Auditor wajib diisi sebagai bagian kertas kerja.");
      return;
    }
    if (finding && !draft.dueDate) {
      setError("Kategori ini menjadi temuan. Batas waktu perbaikan wajib diisi.");
      return;
    }

    const ok = await run(
      `/audit-flow/assessments/${selected.assessment.id}/field-decision`,
      { method: "POST", body: JSON.stringify(draft) },
      finding
        ? "Hasil, kertas kerja, dan temuan berhasil disimpan."
        : "Hasil dan kertas kerja berhasil disimpan.",
    );
    if (ok) {
      setSelected(null);
      setMessage(
        finding
          ? "Butir otomatis masuk Temuan & CAPA."
          : "Butir selesai tanpa temuan.",
      );
      setError("");
      await load();
    }
  }

  async function completeFieldAudit() {
    const ok = await run(
      `/audit-flow/workspaces/${workspace.id}/field-audit/complete`,
      { method: "POST", body: "{}" },
      "Assessment lapangan selesai dan masuk tahap laporan.",
    );
    if (ok) await load();
  }

  if (!data) {
    return <section className="ami-panel"><div className="empty">Memuat assessment lapangan…</div></section>;
  }

  return (
    <section className="ami-panel source-field-panel">
      <div className="field-heading">
        <div>
          <h2>Assessment Lapangan Auditor</h2>
          <p>
            SPMI dan ISO memakai kategori berbeda. Kertas kerja dan temuan dibuat
            dari keputusan pada formulir yang sama.
          </p>
        </div>
        <div className="field-progress">
          <b>{completed}/{questions.length}</b>
          <span>butir diputuskan</span>
        </div>
      </div>

      <div className="category-guide">
        <div>
          <b>SPMI</b>
          <span>Melampaui · Tercapai · Tidak Tercapai · Belum Diukur</span>
          <small>Tidak Tercapai dan Belum Diukur otomatis menjadi temuan.</small>
        </div>
        <div>
          <b>ISO 9001:2015</b>
          <span>C · OBS · KTS/NC Minor · KTS/NC Mayor · NA</span>
          <small>OBS, KTS/NC, dan NA otomatis menjadi temuan.</small>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {isLead && (
        <div className="field-complete-bar">
          <span>
            {allCompleted
              ? "Seluruh butir sudah diputuskan."
              : `${questions.length - completed} butir belum diputuskan.`}
          </span>
          <button
            type="button"
            className="primary"
            disabled={busy || !allCompleted}
            onClick={completeFieldAudit}
          >
            Selesaikan Assessment Lapangan
          </button>
        </div>
      )}

      <div className="field-question-list">
        {questions.map((question: any) => {
          const iso = isIsoQuestion(question);
          const result =
            question.assessment?.processResult ||
            question.assessment?.standardResult;
          const status = question.assessment?.responseStatus || "NOT_STARTED";
          return (
            <article className="field-question-card" key={question.id}>
              <header>
                <div>
                  <div className="source-tags">
                    <span className={iso ? "iso" : "spmi"}>
                      {iso ? "ISO" : "SPMI"}
                    </span>
                    <span>
                      {iso
                        ? `Klausul ${question.masterQuestion?.isoClause?.code || "—"}`
                        : question.masterQuestion?.standard?.code || "Standar internal"}
                    </span>
                  </div>
                  <h3>{question.publishedQuestion || question.questionSnapshot}</h3>
                  <p>
                    Bukti: {question.publishedExpectedEvidence || question.defaultExpectedEvidence || "Tidak ditentukan"}
                  </p>
                </div>
                <div className="result-stack">
                  <span className="ami-pill">{status.replaceAll("_", " ")}</span>
                  {result && <b>{resultLabel(result)}</b>}
                </div>
              </header>
              <div className="field-auditee-context">
                <div><small>Jawaban Auditee</small><p>{question.assessment?.implementationDescription || "—"}</p></div>
                <div><small>Ringkasan bukti</small><p>{question.assessment?.evidenceSummary || "—"}</p></div>
              </div>
              <footer>
                <button
                  type="button"
                  className="small primary"
                  onClick={() => openDecision(question)}
                >
                  {result ? "Periksa/Ubah Hasil" : "Tetapkan Hasil Lapangan"}
                </button>
              </footer>
            </article>
          );
        })}
      </div>

      {selected && (
        <div className="ami-modal" role="dialog" aria-modal="true">
          <div className="ami-dialog source-field-dialog">
            <header className="dialog-header">
              <div>
                <div className="source-tags">
                  <span className={isIsoQuestion(selected) ? "iso" : "spmi"}>
                    {isIsoQuestion(selected) ? "ISO 9001:2015" : "SPMI"}
                  </span>
                </div>
                <h3>Keputusan Assessment Lapangan</h3>
                <p>{selected.publishedQuestion || selected.questionSnapshot}</p>
              </div>
              <button type="button" className="dialog-close" onClick={() => setSelected(null)}>×</button>
            </header>

            <div className="dialog-body">
              <section className="decision-section">
                <h4>1. Kategori hasil</h4>
                <label>
                  Hasil audit
                  {isIsoQuestion(selected) ? (
                    <select
                      value={draft.processResult || "C"}
                      onChange={(event) =>
                        setDraft({ ...draft, processResult: event.target.value })
                      }
                    >
                      {ISO_RESULTS.map(([value, name]) => (
                        <option key={value} value={value}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={draft.standardResult || "TERCAPAI"}
                      onChange={(event) =>
                        setDraft({ ...draft, standardResult: event.target.value })
                      }
                    >
                      {STANDARD_RESULTS.map(([value, name]) => (
                        <option key={value} value={value}>{name}</option>
                      ))}
                    </select>
                  )}
                </label>
                <div className={requiresFinding(selected, draft) ? "finding-alert" : "clear-alert"}>
                  {requiresFinding(selected, draft)
                    ? "Kategori ini otomatis menjadi temuan audit."
                    : "Kategori ini selesai tanpa temuan."}
                </div>
              </section>

              <section className="decision-section">
                <h4>2. Kertas kerja Auditor</h4>
                <div className="two-column">
                  <label>
                    Sampel yang diperiksa
                    <input
                      value={draft.sampleDescription || ""}
                      onChange={(event) =>
                        setDraft({ ...draft, sampleDescription: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Pihak yang diwawancarai
                    <input
                      value={draft.interviewee || ""}
                      onChange={(event) =>
                        setDraft({ ...draft, interviewee: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Bukti objektif
                  <textarea
                    rows={3}
                    value={draft.objectiveEvidence || ""}
                    onChange={(event) =>
                      setDraft({ ...draft, objectiveEvidence: event.target.value })
                    }
                  />
                </label>
                <label>
                  Analisis Auditor
                  <textarea
                    rows={3}
                    value={draft.auditorAnalysis || ""}
                    onChange={(event) =>
                      setDraft({ ...draft, auditorAnalysis: event.target.value })
                    }
                  />
                </label>
                <label>
                  Catatan hasil lapangan
                  <textarea
                    rows={3}
                    value={draft.note || ""}
                    onChange={(event) =>
                      setDraft({ ...draft, note: event.target.value })
                    }
                  />
                </label>
              </section>

              {requiresFinding(selected, draft) && (
                <section className="decision-section finding-section">
                  <h4>3. Temuan audit</h4>
                  <div className="two-column">
                    <label>
                      Batas perbaikan
                      <input
                        type="date"
                        value={draft.dueDate || ""}
                        onChange={(event) =>
                          setDraft({ ...draft, dueDate: event.target.value })
                        }
                      />
                    </label>
                    {(!isIsoQuestion(selected) || draft.processResult === "NA") && (
                      <label>
                        Klasifikasi temuan
                        <select
                          value={draft.findingType || "OBS"}
                          onChange={(event) =>
                            setDraft({ ...draft, findingType: event.target.value })
                          }
                        >
                          {FINDING_TYPES.map(([value, name]) => (
                            <option key={value} value={value}>{name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <label>
                    Kondisi yang ditemukan
                    <textarea
                      rows={2}
                      value={draft.condition || ""}
                      onChange={(event) =>
                        setDraft({ ...draft, condition: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Pernyataan kesenjangan
                    <textarea
                      rows={2}
                      value={draft.gapStatement || ""}
                      onChange={(event) =>
                        setDraft({ ...draft, gapStatement: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Dampak atau risiko
                    <textarea
                      rows={2}
                      value={draft.riskImpact || ""}
                      onChange={(event) =>
                        setDraft({ ...draft, riskImpact: event.target.value })
                      }
                    />
                  </label>
                </section>
              )}
            </div>

            <footer className="dialog-actions">
              <button type="button" onClick={() => setSelected(null)}>Batal</button>
              <button type="button" className="primary" disabled={busy} onClick={saveDecision}>
                Simpan Hasil Lapangan
              </button>
            </footer>
          </div>
        </div>
      )}

      <style jsx>{`
        .field-heading, .field-complete-bar, .field-question-card header,
        .field-question-card footer, .dialog-header, .dialog-actions {
          display: flex; justify-content: space-between; gap: 1rem; align-items: center;
        }
        .field-heading h2, .dialog-header h3 { margin: 0; }
        .field-heading p, .dialog-header p { margin: .35rem 0 0; color: #64748b; }
        .field-progress { display: grid; text-align: center; min-width: 105px; padding: .65rem; border-radius: 12px; background: #eff6ff; }
        .field-progress b { font-size: 1.2rem; color: #1d4ed8; }
        .field-progress span { font-size: .78rem; color: #64748b; }
        .category-guide { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin: 1rem 0; }
        .category-guide > div { display: grid; gap: .3rem; padding: .9rem; border: 1px solid #dbe4ee; border-radius: 12px; background: #f8fafc; }
        .category-guide small { color: #64748b; }
        .field-complete-bar { margin: 1rem 0; padding: .8rem 1rem; border-radius: 12px; background: #f1f5f9; }
        .field-question-list { display: grid; gap: .85rem; }
        .field-question-card { border: 1px solid #dbe4ee; border-radius: 14px; background: #fff; overflow: hidden; }
        .field-question-card header { align-items: flex-start; padding: 1rem; }
        .field-question-card h3 { margin: .45rem 0; font-size: 1rem; }
        .field-question-card p { margin: 0; color: #64748b; }
        .field-question-card footer { padding: .75rem 1rem; border-top: 1px solid #eef2f7; background: #f8fafc; }
        .source-tags { display: flex; flex-wrap: wrap; gap: .4rem; }
        .source-tags span { padding: .25rem .55rem; border-radius: 999px; background: #e2e8f0; font-size: .75rem; font-weight: 700; }
        .source-tags .iso { background: #dbeafe; color: #1d4ed8; }
        .source-tags .spmi { background: #dcfce7; color: #166534; }
        .result-stack { display: grid; gap: .4rem; text-align: right; }
        .result-stack b { color: #0f4c6e; }
        .field-auditee-context { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; padding: 0 1rem 1rem; }
        .field-auditee-context > div { padding: .75rem; border-radius: 10px; background: #f8fafc; }
        .field-auditee-context small { color: #64748b; font-weight: 700; }
        .field-auditee-context p { margin: .35rem 0 0; color: #334155; }
        .source-field-dialog { width: min(920px, calc(100vw - 28px)); max-height: calc(100vh - 30px); overflow: auto; }
        .dialog-header, .dialog-actions { padding: 1rem 1.2rem; border-bottom: 1px solid #e2e8f0; }
        .dialog-actions { border-top: 1px solid #e2e8f0; border-bottom: 0; justify-content: flex-end; }
        .dialog-body { padding: 1.1rem; display: grid; gap: 1rem; }
        .decision-section { display: grid; gap: .75rem; padding: 1rem; border: 1px solid #dbe4ee; border-radius: 12px; }
        .decision-section h4 { margin: 0; }
        .decision-section label { display: grid; gap: .35rem; font-weight: 700; color: #334155; }
        .decision-section input, .decision-section select, .decision-section textarea { width: 100%; box-sizing: border-box; padding: .65rem .75rem; border: 1px solid #b8c7d9; border-radius: 9px; font: inherit; }
        .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
        .finding-alert, .clear-alert { padding: .7rem .8rem; border-radius: 9px; font-weight: 700; }
        .finding-alert { background: #fff7ed; color: #9a3412; }
        .clear-alert { background: #ecfdf5; color: #166534; }
        .finding-section { border-color: #fdba74; background: #fffbeb; }
        @media (max-width: 720px) {
          .category-guide, .field-auditee-context, .two-column { grid-template-columns: 1fr; }
          .field-heading, .field-complete-bar, .field-question-card header { align-items: stretch; flex-direction: column; }
          .result-stack { text-align: left; }
        }
      `}</style>
    </section>
  );
}
