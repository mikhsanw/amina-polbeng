"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AmiAuditWorkspace } from "./AmiAuditWorkspace";

function dateValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dateLabel(value: unknown) {
  if (!value) return "Belum ditetapkan";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Belum ditetapkan"
    : date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function hasRole(user: any, ...roles: string[]) {
  return user.roles?.some((role: string) => roles.includes(role));
}

const DEADLINES = [
  ["instrumentReviewEnd", "Submit telaah instrumen"],
  ["instrumentVerificationEnd", "Keputusan Verifikator"],
  ["selfAssessmentEnd", "Unggah self-assessment Auditee"],
  ["selfAssessmentReviewEnd", "Review Auditor"],
  ["fieldAuditEnd", "Assessment lapangan"],
  ["reportingEnd", "Penyusunan laporan"],
  ["followUpEnd", "CAPA dan tindak lanjut"],
] as const;

export function DeadlineAwareWorkspace({
  id,
  user,
}: {
  id: string;
  user: any;
}) {
  const [data, setData] = useState<any>(null);
  const [deadlines, setDeadlines] = useState<any>({});
  const [deadlineDraft, setDeadlineDraft] = useState<any>({});
  const [publication, setPublication] = useState<any>({});
  const [adminDecision, setAdminDecision] = useState("APPROVE");
  const [decisionDraft, setDecisionDraft] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [workspaceData, plan] = await Promise.all([
      api(`/audit-flow/${id}`),
      api(`/audit-flow/workspaces/${id}/deadlines`),
    ]);
    setData(workspaceData);
    setDeadlines(plan || {});
    const draft: any = {};
    for (const [key] of DEADLINES) draft[key] = dateValue(plan?.[key]);
    setDeadlineDraft(draft);
    setPublication({
      selfAssessmentEnd: dateValue(plan?.selfAssessmentEnd),
      selfAssessmentReviewEnd: dateValue(plan?.selfAssessmentReviewEnd),
      note: "",
    });
    setDecisionDraft((current: any) => ({
      ...current,
      fieldAuditEnd: current.fieldAuditEnd || dateValue(plan?.fieldAuditEnd),
      reportingEnd: current.reportingEnd || dateValue(plan?.reportingEnd),
      followUpEnd: current.followUpEnd || dateValue(plan?.followUpEnd),
      selfAssessmentReviewEnd:
        current.selfAssessmentReviewEnd ||
        dateValue(plan?.selfAssessmentReviewEnd),
    }));
  }

  useEffect(() => {
    load().catch((reason: any) => setError(reason.message));
  }, [id]);

  async function perform(
    path: string,
    init: RequestInit,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, init);
      setMessage(success);
      window.setTimeout(() => location.reload(), 450);
      return true;
    } catch (reason: any) {
      setError(reason.message || "Proses gagal.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const workspace = data?.workspace;
  const myAssignment = workspace?.team?.find(
    (member: any) => member.userId === user.id,
  )?.role;
  const isLead = myAssignment === "LEAD_AUDITOR";
  const isAdmin = hasRole(user, "SUPER_ADMIN", "ADMIN_MUTU");
  const assignedAuditors = (workspace?.team || []).filter((member: any) =>
    ["AUDITOR", "LEAD_AUDITOR"].includes(member.role),
  );
  const existingUserIds = new Set(
    (workspace?.team || []).map((member: any) => member.userId),
  );
  const replacementCandidates = (data?.users || []).filter(
    (candidate: any) =>
      candidate.unitId !== workspace?.unitId && !existingUserIds.has(candidate.id),
  );

  const currentDeadline = useMemo(() => {
    if (!workspace) return null;
    if (["INSTRUMENT_REVIEW"].includes(workspace.status)) {
      return ["Submit telaah instrumen", deadlines.instrumentReviewEnd];
    }
    if (workspace.instrumentStatus === "PENDING_VERIFICATION") {
      return ["Keputusan Verifikator", deadlines.instrumentVerificationEnd];
    }
    if (workspace.status === "SELF_ASSESSMENT") {
      return ["Unggah Auditee", deadlines.selfAssessmentEnd];
    }
    if (workspace.status === "DESK_REVIEW") {
      return ["Review Auditor", deadlines.selfAssessmentReviewEnd];
    }
    if (workspace.status === "FIELD_AUDIT") {
      return ["Assessment lapangan", deadlines.fieldAuditEnd];
    }
    if (workspace.status === "REPORTING") {
      return ["Penyusunan laporan", deadlines.reportingEnd];
    }
    if (workspace.status === "FOLLOW_UP") {
      return ["CAPA dan tindak lanjut", deadlines.followUpEnd];
    }
    return null;
  }, [workspace, deadlines]);

  if (!workspace) {
    return <div className="empty">Memuat kendali tenggat audit…</div>;
  }

  async function saveDeadlines(event: FormEvent) {
    event.preventDefault();
    await perform(
      `/audit-flow/workspaces/${id}/deadlines`,
      { method: "PUT", body: JSON.stringify(deadlineDraft) },
      "Tenggat audit diperbarui.",
    );
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    await perform(
      `/audit-flow/workspaces/${id}/instrument/activate`,
      { method: "POST", body: JSON.stringify(publication) },
      "Instrumen dipublikasikan dan self-assessment dibuka.",
    );
  }

  async function submitReview() {
    await perform(
      `/audit-flow/workspaces/${id}/desk-review/submit`,
      { method: "POST", body: "{}" },
      "Hasil review dikirim kepada Admin Mutu.",
    );
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    const path =
      adminDecision === "APPROVE"
        ? "approve"
        : adminDecision === "RETURN"
          ? "return"
          : "reassign";
    await perform(
      `/audit-flow/workspaces/${id}/desk-review/${path}`,
      { method: "POST", body: JSON.stringify(decisionDraft) },
      adminDecision === "APPROVE"
        ? "Review disetujui dan assessment lapangan dibuka."
        : adminDecision === "RETURN"
          ? "Review dikembalikan kepada tim Auditor."
          : "Auditor diganti dan review ulang dibuka.",
    );
  }

  const className = [
    "deadline-aware-workspace",
    workspace.instrumentStatus === "APPROVED" ? "publication-required" : "",
    workspace.status === "DESK_REVIEW" ? "admin-gated-review" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <section className="deadline-control-panel">
        <div className="deadline-control-heading">
          <div>
            <small>KENDALI TENGGAT DAN TRANSISI</small>
            <h2>{currentDeadline?.[0] || "Tahap keputusan"}</h2>
            <p>
              {currentDeadline
                ? `Batas akhir: ${dateLabel(currentDeadline[1])}`
                : "Tahap berikutnya menunggu keputusan atau penyelesaian proses."}
            </p>
          </div>
          <span className="deadline-status">{String(workspace.status).replaceAll("_", " ")}</span>
        </div>

        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        <div className="deadline-summary">
          {DEADLINES.map(([key, name]) => (
            <div key={key}>
              <small>{name}</small>
              <b>{dateLabel(deadlines?.[key])}</b>
            </div>
          ))}
        </div>

        {isAdmin && (
          <details className="deadline-editor-box">
            <summary>Ubah Tenggat Tahapan</summary>
            <form onSubmit={saveDeadlines}>
              <div className="deadline-form-grid">
                {DEADLINES.map(([key, name]) => (
                  <label key={key}>
                    {name}
                    <input
                      type="date"
                      value={deadlineDraft[key] || ""}
                      onChange={(event) =>
                        setDeadlineDraft({
                          ...deadlineDraft,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button className="primary" disabled={busy}>
                Simpan Tenggat
              </button>
            </form>
          </details>
        )}

        {isAdmin && workspace.instrumentStatus === "APPROVED" && (
          <form className="decision-box" onSubmit={publish}>
            <h3>Publikasi Instrumen kepada Auditee</h3>
            <p>
              Instrumen belum dapat dipublikasikan sebelum batas unggah Auditee
              dan review Auditor ditetapkan.
            </p>
            <div className="deadline-form-grid">
              <label>
                Paling lambat unggah Auditee
                <input
                  type="date"
                  required
                  value={publication.selfAssessmentEnd || ""}
                  onChange={(event) =>
                    setPublication({
                      ...publication,
                      selfAssessmentEnd: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Paling lambat review Auditor
                <input
                  type="date"
                  required
                  value={publication.selfAssessmentReviewEnd || ""}
                  onChange={(event) =>
                    setPublication({
                      ...publication,
                      selfAssessmentReviewEnd: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label>
              Catatan publikasi
              <textarea
                rows={2}
                value={publication.note || ""}
                onChange={(event) =>
                  setPublication({ ...publication, note: event.target.value })
                }
              />
            </label>
            <button className="primary" disabled={busy}>
              Publikasikan dan Buka Self-Assessment
            </button>
          </form>
        )}

        {isLead && workspace.status === "DESK_REVIEW" && (
          <div className="decision-box">
            <h3>Kirim Hasil Review kepada Admin Mutu</h3>
            <p>
              Setelah seluruh jawaban dan bukti diputuskan, hasil review masuk ke
              meja Admin Mutu. Assessment lapangan belum dibuka pada langkah ini.
            </p>
            <button className="primary" disabled={busy} onClick={submitReview}>
              Kirim Hasil Review
            </button>
          </div>
        )}

        {isAdmin && workspace.status === "AUDIT" && (
          <form className="decision-box" onSubmit={decide}>
            <h3>Keputusan Admin Mutu atas Review Auditor</h3>
            <div className="decision-options">
              <label>
                <input
                  type="radio"
                  name="admin-decision"
                  checked={adminDecision === "APPROVE"}
                  onChange={() => setAdminDecision("APPROVE")}
                />
                Lanjutkan ke assessment lapangan
              </label>
              <label>
                <input
                  type="radio"
                  name="admin-decision"
                  checked={adminDecision === "RETURN"}
                  onChange={() => setAdminDecision("RETURN")}
                />
                Kembalikan untuk review ulang
              </label>
              <label>
                <input
                  type="radio"
                  name="admin-decision"
                  checked={adminDecision === "REASSIGN"}
                  onChange={() => setAdminDecision("REASSIGN")}
                />
                Ganti Auditor dan lakukan review ulang
              </label>
            </div>

            {adminDecision === "APPROVE" ? (
              <div className="deadline-form-grid">
                <label>
                  Batas assessment lapangan
                  <input
                    type="date"
                    required
                    value={decisionDraft.fieldAuditEnd || ""}
                    onChange={(event) =>
                      setDecisionDraft({
                        ...decisionDraft,
                        fieldAuditEnd: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Batas penyusunan laporan
                  <input
                    type="date"
                    required
                    value={decisionDraft.reportingEnd || ""}
                    onChange={(event) =>
                      setDecisionDraft({
                        ...decisionDraft,
                        reportingEnd: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Batas CAPA/tindak lanjut
                  <input
                    type="date"
                    required
                    value={decisionDraft.followUpEnd || ""}
                    onChange={(event) =>
                      setDecisionDraft({
                        ...decisionDraft,
                        followUpEnd: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ) : (
              <>
                {adminDecision === "REASSIGN" && (
                  <div className="deadline-form-grid">
                    <label>
                      Auditor yang diganti
                      <select
                        required
                        value={decisionDraft.oldUserId || ""}
                        onChange={(event) =>
                          setDecisionDraft({
                            ...decisionDraft,
                            oldUserId: event.target.value,
                          })
                        }
                      >
                        <option value="">Pilih</option>
                        {assignedAuditors.map((member: any) => (
                          <option key={member.userId} value={member.userId}>
                            {member.user.fullName} · {member.role.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Auditor pengganti
                      <select
                        required
                        value={decisionDraft.newUserId || ""}
                        onChange={(event) =>
                          setDecisionDraft({
                            ...decisionDraft,
                            newUserId: event.target.value,
                          })
                        }
                      >
                        <option value="">Pilih</option>
                        {replacementCandidates.map((candidate: any) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.fullName} · {candidate.unit?.name || "Tanpa unit"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <label>
                  Batas akhir review ulang
                  <input
                    type="date"
                    required
                    value={decisionDraft.selfAssessmentReviewEnd || ""}
                    onChange={(event) =>
                      setDecisionDraft({
                        ...decisionDraft,
                        selfAssessmentReviewEnd: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}

            <label>
              Catatan keputusan
              <textarea
                rows={3}
                required={adminDecision !== "APPROVE"}
                value={decisionDraft.note || ""}
                onChange={(event) =>
                  setDecisionDraft({ ...decisionDraft, note: event.target.value })
                }
              />
            </label>
            <button className="primary" disabled={busy}>
              Simpan Keputusan Admin Mutu
            </button>
          </form>
        )}

        {isLead && workspace.status === "REPORTING" && (
          <div className="decision-box">
            <h3>Penyelesaian Tahap Pelaporan</h3>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                perform(
                  `/audit-flow/workspaces/${id}/reporting/complete`,
                  { method: "POST", body: "{}" },
                  "Tahap pelaporan selesai dan CAPA dibuka.",
                )
              }
            >
              Selesaikan Pelaporan
            </button>
          </div>
        )}

        {isLead && workspace.status === "FOLLOW_UP" && (
          <div className="decision-box">
            <h3>Penyelesaian CAPA dan Tindak Lanjut</h3>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                perform(
                  `/audit-flow/workspaces/${id}/follow-up/complete`,
                  { method: "POST", body: "{}" },
                  "Tindak lanjut selesai dan dikirim untuk penutupan.",
                )
              }
            >
              Kirim untuk Penutupan Audit
            </button>
          </div>
        )}

        {isAdmin && workspace.status === "REPORT_REVIEW" && (
          <div className="decision-box">
            <h3>Penutupan Audit</h3>
            <p>
              Sistem telah menyelesaikan seluruh tahapan. Audit dapat ditutup jika
              tidak ada temuan terbuka.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                perform(
                  `/audit-flow/workspaces/${id}/close`,
                  { method: "POST", body: "{}" },
                  "Audit ditutup.",
                )
              }
            >
              Tutup Audit
            </button>
          </div>
        )}
      </section>

      <AmiAuditWorkspace id={id} user={user} />

      <style jsx global>{`
        .deadline-aware-workspace .phase-schedule-strip { display: none; }
        .deadline-aware-workspace.publication-required .instrument-workflow-actions { display: none; }
        .deadline-aware-workspace.admin-gated-review .assessment-stage-actions { display: none; }
      `}</style>
      <style jsx>{`
        .deadline-control-panel { margin-bottom:1rem; padding:1rem; border:1px solid #bfdbfe; border-radius:14px; background:#eff6ff; }
        .deadline-control-heading { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; }
        .deadline-control-heading h2 { margin:.15rem 0; }
        .deadline-control-heading p { margin:0; color:#475569; }
        .deadline-status { padding:.35rem .65rem; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-weight:700; }
        .deadline-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.65rem; margin-top:1rem; }
        .deadline-summary div { display:grid; gap:.2rem; padding:.7rem; border:1px solid #dbeafe; border-radius:9px; background:white; }
        .deadline-summary small { color:#64748b; }
        .deadline-editor-box, .decision-box { margin-top:1rem; padding:1rem; border:1px solid #cbd5e1; border-radius:10px; background:white; }
        .deadline-editor-box summary { cursor:pointer; font-weight:700; }
        .deadline-editor-box form { margin-top:1rem; }
        .deadline-form-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; }
        .decision-options { display:grid; gap:.45rem; margin:.75rem 0; }
        .decision-options label { display:flex; flex-direction:row; align-items:center; gap:.45rem; }
        .decision-options input { width:auto; }
        @media(max-width:900px){ .deadline-summary,.deadline-form-grid{grid-template-columns:1fr 1fr;} }
        @media(max-width:600px){ .deadline-summary,.deadline-form-grid{grid-template-columns:1fr;} .deadline-control-heading{flex-direction:column;} }
      `}</style>
    </div>
  );
}
