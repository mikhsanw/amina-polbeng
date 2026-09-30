"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

type ModalState =
  | { type: "capa"; finding: any; action?: any }
  | { type: "auditor"; finding: any; action: any }
  | { type: "lead"; finding: any; action: any; recommendation: any }
  | null;

const label = (value: unknown) => {
  const text = String(value ?? "—");
  const labels: Record<string, string> = {
    READY_VERIFY: "MENUNGGU VERIFIKASI",
    EFFECTIVE: "CLOSE / EFEKTIF",
    NOT_EFFECTIVE: "TETAP OPEN",
    IMPLEMENTATION: "TINDAK LANJ BERJALAN",
    VERIFICATION: "MENUNGGU KEPUTUSAN",
    KTS_MINOR: "KTS/NC MINOR",
    KTS_MAYOR: "KTS/NC MAYOR",
  };
  return labels[text] || text.replaceAll("_", " ");
};

export function FindingCapaPanel({
  workspace,
  user,
  myAssignment,
  busy,
  run,
}: {
  workspace: any;
  data: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const [flow, setFlow] = useState<any>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [draft, setDraft] = useState<any>({ analysisMethod: "FIVE_WHY" });

  const load = async () => {
    try {
      setFlow(await api(`/audit-flow/workspaces/${workspace.id}/capa-flow`));
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Data CAPA gagal dimuat.");
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [workspace.id]);

  const isAuditee =
    user.roles?.includes("AUDITEE") && workspace.unitId === user.unitId;
  const isAuditor = ["AUDITOR", "LEAD_AUDITOR"].includes(
    myAssignment || "",
  );
  const isLead = myAssignment === "LEAD_AUDITOR";
  const findings = flow?.findings || [];

  function openCapa(finding: any, action?: any) {
    setDraft({
      correction: action?.correction || "",
      analysisMethod: action?.analysisMethod || "FIVE_WHY",
      rootCauseStatement: action?.rootCauseStatement || "",
      correctiveAction: action?.correctiveAction || "",
      successIndicator: action?.successIndicator || "",
      targetDate: action?.targetDate
        ? new Date(action.targetDate).toISOString().slice(0, 10)
        : "",
      progressNote: action?.progressNote || "",
      evidenceTitle: "",
      evidenceUrl: "",
    });
    setModal({ type: "capa", finding, action });
  }

  function openAuditor(finding: any, action: any) {
    setDraft({
      decision: "CLOSE",
      implementationResult: "",
      effectivenessResult: "",
      nextReviewDate: "",
    });
    setModal({ type: "auditor", finding, action });
  }

  function openLead(finding: any, action: any, recommendation: any) {
    setDraft({
      decision: recommendation.status === "EFFECTIVE" ? "CLOSE" : "OPEN",
      note: recommendation.effectivenessResult || "",
    });
    setModal({ type: "lead", finding, action, recommendation });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!modal) return;
    let ok = false;
    if (modal.type === "capa") {
      ok = await run(
        `/audit-flow/findings/${modal.finding.id}/capa-submit`,
        { method: "POST", body: JSON.stringify(draft) },
        "CAPA dan link bukti dikirim kepada Auditor.",
      );
    } else if (modal.type === "auditor") {
      ok = await run(
        `/audit-flow/actions/${modal.action.id}/auditor-verification`,
        { method: "POST", body: JSON.stringify(draft) },
        "Rekomendasi Close/Open dikirim kepada Ketua Auditor.",
      );
    } else {
      ok = await run(
        `/audit-flow/actions/${modal.action.id}/lead-verification`,
        { method: "POST", body: JSON.stringify(draft) },
        draft.decision === "CLOSE"
          ? "Temuan ditutup oleh Ketua Auditor."
          : "Temuan tetap Open dan dikembalikan untuk tindak lanjut.",
      );
    }
    if (ok) {
      setModal(null);
      setDraft({ analysisMethod: "FIVE_WHY" });
      await load();
    }
  }

  return (
    <section className="capa-flow-v2">
      <article className="ami-panel">
        <div className="ami-panel-title">
          <div>
            <h2>Temuan dan CAPA</h2>
            <p>
              Laporan tetap dapat dibuat walaupun temuan masih Open atau Auditee
              belum melengkapi CAPA. Status aktual akan tercantum dalam laporan.
            </p>
          </div>
          <span className="ami-pill">{findings.length} temuan</span>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="flow-strip">
          <span>1. Auditee isi CAPA + link bukti</span>
          <span>2. Auditor rekomendasikan Close/Open</span>
          <span>3. Ketua Auditor putuskan Close/Open</span>
          <span>4. Laporan mencatat status aktual</span>
        </div>

        <div className="finding-list">
          {findings.length ? (
            findings.map((finding: any) => {
              const action = finding.actions?.[0];
              const recommendation = action?.verifications?.find(
                (item: any) => item.auditorUserId && !item.decidedAt,
              );
              const finalVerification = action?.verifications?.find(
                (item: any) => item.decidedAt,
              );
              const overdue =
                action?.targetDate &&
                new Date(action.targetDate).getTime() < Date.now() &&
                finding.status !== "CLOSED";

              return (
                <section className="finding-card" key={finding.id}>
                  <header>
                    <div>
                      <small>{finding.code}</small>
                      <h3>{label(finding.findingType)}</h3>
                    </div>
                    <span className={`ami-pill ${finding.status === "CLOSED" ? "closed" : "open"}`}>
                      {label(finding.status)}
                    </span>
                  </header>

                  <div className="finding-grid">
                    <div><b>Kondisi</b><p>{finding.condition}</p></div>
                    <div><b>Kesenjangan</b><p>{finding.gapStatement || "—"}</p></div>
                    <div><b>Dampak</b><p>{finding.riskImpact || "—"}</p></div>
                  </div>

                  {!action && (
                    <div className="status-note warning">
                      Auditee belum menyampaikan CAPA. Temuan tetap Open dan kondisi
                      ini akan dicantumkan dalam laporan.
                    </div>
                  )}

                  {action && (
                    <div className="capa-card">
                      <div className="capa-head">
                        <div>
                          <b>CAPA</b>
                          <span>{label(action.status)} · progres {action.progressPercent}%</span>
                        </div>
                        {overdue && <span className="overdue">TERLAMBAT</span>}
                      </div>
                      <p><b>Koreksi:</b> {action.correction}</p>
                      <p><b>Akar masalah:</b> {action.rootCauseStatement}</p>
                      <p><b>Tindakan korektif:</b> {action.correctiveAction}</p>
                      <p><b>Indikator:</b> {action.successIndicator}</p>
                      <p>
                        <b>Target:</b>{" "}
                        {new Date(action.targetDate).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })}
                      </p>

                      <div className="capa-evidence-list">
                        <b>Bukti CAPA</b>
                        {(action.evidences || []).length ? (
                          action.evidences.map((evidence: any) => (
                            <a
                              key={evidence.id}
                              href={evidence.storageKey}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {evidence.title}
                            </a>
                          ))
                        ) : (
                          <span>Belum ada link bukti CAPA.</span>
                        )}
                      </div>

                      {recommendation && (
                        <div className="status-note">
                          <b>Rekomendasi Auditor:</b>{" "}
                          {recommendation.status === "EFFECTIVE" ? "Close" : "Tetap Open"}
                          <br />
                          {recommendation.implementationResult}
                          <br />
                          {recommendation.effectivenessResult}
                        </div>
                      )}

                      {finalVerification && (
                        <div className="status-note final">
                          <b>Keputusan Ketua Auditor:</b>{" "}
                          {finalVerification.status === "EFFECTIVE" ? "Close" : "Tetap Open"}
                          <br />
                          {finalVerification.effectivenessResult}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ami-actions finding-actions">
                    {isAuditee &&
                      finding.status !== "CLOSED" &&
                      (!action ||
                        ["IN_PROGRESS", "NOT_EFFECTIVE", "RETURNED", "APPROVED"].includes(
                          action.status,
                        )) && (
                        <button
                          type="button"
                          className="small primary"
                          onClick={() => openCapa(finding, action)}
                        >
                          {action ? "Perbarui dan Kirim Ulang CAPA" : "Isi dan Kirim CAPA"}
                        </button>
                      )}

                    {isAuditor && action?.status === "READY_VERIFY" && !recommendation && (
                      <button
                        type="button"
                        className="small primary"
                        onClick={() => openAuditor(finding, action)}
                      >
                        Verifikasi dan Rekomendasikan Close/Open
                      </button>
                    )}

                    {isLead && action?.status === "READY_VERIFY" && recommendation && (
                      <button
                        type="button"
                        className="small primary"
                        onClick={() => openLead(finding, action, recommendation)}
                      >
                        Putuskan Close/Open
                      </button>
                    )}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="empty">Tidak terdapat temuan audit.</div>
          )}
        </div>
      </article>

      {modal && (
        <div className="ami-modal" role="dialog" aria-modal="true">
          <form className="ami-dialog capa-dialog" onSubmit={submit}>
            <header>
              <div>
                <small>{modal.finding.code}</small>
                <h3>
                  {modal.type === "capa"
                    ? "CAPA dan Bukti Pelaksanaan"
                    : modal.type === "auditor"
                      ? "Rekomendasi Auditor"
                      : "Keputusan Ketua Auditor"}
                </h3>
              </div>
              <button type="button" className="dialog-close" onClick={() => setModal(null)}>
                ×
              </button>
            </header>

            <div className="modal-fields">
              {modal.type === "capa" && (
                <>
                  <TextArea label="Koreksi langsung" value={draft.correction} set={(value) => setDraft({ ...draft, correction: value })} />
                  <label>
                    Metode analisis akar masalah
                    <select value={draft.analysisMethod} onChange={(event) => setDraft({ ...draft, analysisMethod: event.target.value })}>
                      <option value="FIVE_WHY">5 Why</option>
                      <option value="FISHBONE">Fishbone</option>
                      <option value="OTHER">Metode lain</option>
                    </select>
                  </label>
                  <TextArea label="Akar masalah" value={draft.rootCauseStatement} set={(value) => setDraft({ ...draft, rootCauseStatement: value })} />
                  <TextArea label="Tindakan korektif" value={draft.correctiveAction} set={(value) => setDraft({ ...draft, correctiveAction: value })} />
                  <TextArea label="Indikator keberhasilan" value={draft.successIndicator} set={(value) => setDraft({ ...draft, successIndicator: value })} />
                  <label>
                    Target penyelesaian
                    <input required type="date" value={draft.targetDate || ""} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} />
                  </label>
                  <TextArea label="Catatan pelaksanaan" value={draft.progressNote} set={(value) => setDraft({ ...draft, progressNote: value })} />
                  <label>
                    Nama dokumen bukti CAPA
                    <input required value={draft.evidenceTitle || ""} onChange={(event) => setDraft({ ...draft, evidenceTitle: event.target.value })} />
                  </label>
                  <label>
                    Link bukti CAPA
                    <input required type="url" placeholder="https://drive.google.com/..." value={draft.evidenceUrl || ""} onChange={(event) => setDraft({ ...draft, evidenceUrl: event.target.value })} />
                  </label>
                </>
              )}

              {modal.type === "auditor" && (
                <>
                  <Decision value={draft.decision} set={(value) => setDraft({ ...draft, decision: value })} title="Rekomendasi Auditor" />
                  <TextArea label="Hasil pemeriksaan implementasi" value={draft.implementationResult} set={(value) => setDraft({ ...draft, implementationResult: value })} />
                  <TextArea label="Alasan rekomendasi" value={draft.effectivenessResult} set={(value) => setDraft({ ...draft, effectivenessResult: value })} />
                  {draft.decision === "OPEN" && (
                    <label>
                      Tanggal review berikutnya
                      <input type="date" value={draft.nextReviewDate || ""} onChange={(event) => setDraft({ ...draft, nextReviewDate: event.target.value })} />
                    </label>
                  )}
                </>
              )}

              {modal.type === "lead" && (
                <>
                  <div className="recommendation-box">
                    <b>Rekomendasi Auditor</b>
                    <p>{modal.recommendation.status === "EFFECTIVE" ? "Close" : "Tetap Open"}</p>
                    <p>{modal.recommendation.implementationResult}</p>
                    <p>{modal.recommendation.effectivenessResult}</p>
                  </div>
                  <Decision value={draft.decision} set={(value) => setDraft({ ...draft, decision: value })} title="Keputusan final Ketua Auditor" />
                  <TextArea label="Catatan keputusan final" value={draft.note} set={(value) => setDraft({ ...draft, note: value })} />
                </>
              )}
            </div>

            <footer>
              <button type="button" onClick={() => setModal(null)}>Batal</button>
              <button className="primary" disabled={busy}>
                {modal.type === "capa" ? "Kirim CAPA" : "Simpan Keputusan"}
              </button>
            </footer>
          </form>
        </div>
      )}

      <style jsx>{`
        .capa-flow-v2 { display: grid; gap: 1rem; }
        .flow-strip { display: flex; flex-wrap: wrap; gap: .45rem; margin: 1rem 0; }
        .flow-strip span { padding: .45rem .7rem; border-radius: 999px; background: #eff6ff; color: #1e40af; font-size: .78rem; font-weight: 700; }
        .finding-list { display: grid; gap: .9rem; }
        .finding-card { padding: 1rem; border: 1px solid #dbe4ee; border-radius: 14px; background: #fff; }
        .finding-card > header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        .finding-card h3 { margin: .2rem 0; }
        .finding-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem; margin-top: .8rem; }
        .finding-grid > div { padding: .7rem; border-radius: 10px; background: #f8fafc; }
        .finding-grid p, .capa-card p { margin: .3rem 0; }
        .capa-card { display: grid; gap: .5rem; margin-top: .8rem; padding: .85rem; border: 1px solid #dbe4ee; border-radius: 12px; background: #f8fafc; }
        .capa-head { display: flex; justify-content: space-between; gap: .7rem; }
        .capa-head > div { display: grid; gap: .2rem; }
        .overdue { color: #b91c1c; font-weight: 900; }
        .capa-evidence-list { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; }
        .capa-evidence-list a { color: #1d4ed8; font-weight: 800; text-decoration: none; }
        .status-note { padding: .7rem; border-radius: 9px; background: #eff6ff; color: #334155; }
        .status-note.warning { margin-top: .8rem; background: #fff7ed; color: #9a3412; }
        .status-note.final { background: #ecfdf5; }
        .finding-actions { margin-top: .8rem; }
        .capa-dialog { width: min(760px, calc(100vw - 28px)); max-height: calc(100vh - 30px); overflow: auto; }
        .capa-dialog header, .capa-dialog footer { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid #e2e8f0; }
        .capa-dialog footer { justify-content: flex-end; border-top: 1px solid #e2e8f0; border-bottom: 0; }
        .capa-dialog h3 { margin: .2rem 0; }
        .modal-fields { display: grid; gap: .8rem; padding: 1rem 1.2rem; }
        .modal-fields label { display: grid; gap: .35rem; font-weight: 700; }
        .modal-fields input, .modal-fields select { width: 100%; box-sizing: border-box; padding: .7rem; border: 1px solid #b8c7d9; border-radius: 9px; font: inherit; }
        .recommendation-box { padding: .8rem; border-radius: 10px; background: #f8fafc; }
        .recommendation-box p { margin: .3rem 0; }
        @media (max-width: 850px) { .finding-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function TextArea({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea required rows={3} value={value || ""} onChange={(event) => set(event.target.value)} />
      <style jsx>{`
        label { display: grid; gap: .35rem; font-weight: 700; }
        textarea { width: 100%; box-sizing: border-box; padding: .7rem; border: 1px solid #b8c7d9; border-radius: 9px; font: inherit; }
      `}</style>
    </label>
  );
}

function Decision({ value, set, title }: { value: string; set: (value: string) => void; title: string }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <label><input type="radio" name={title} value="CLOSE" checked={value === "CLOSE"} onChange={() => set("CLOSE")} /> Close</label>
      <label><input type="radio" name={title} value="OPEN" checked={value === "OPEN"} onChange={() => set("OPEN")} /> Tetap Open</label>
      <style jsx>{`
        fieldset { display: flex; flex-wrap: wrap; gap: .7rem; padding: .8rem; border: 1px solid #dbe4ee; border-radius: 10px; }
        legend { font-weight: 800; }
        label { display: flex; align-items: center; gap: .35rem; font-weight: 700; }
      `}</style>
    </fieldset>
  );
}
