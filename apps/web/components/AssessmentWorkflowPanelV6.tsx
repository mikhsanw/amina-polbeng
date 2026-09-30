"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { EvidenceFileLinks } from "./EvidenceFileLinks";
import { AssessmentWorkflowPanel as ExistingPanel } from "./AssessmentWorkflowPanelV4";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const isAssignedAuditor = (assignment?: string) =>
  ["AUDITOR", "LEAD_AUDITOR"].includes(assignment || "");

const statusLabel = (value: unknown) => {
  const text = String(value ?? "—");
  const labels: Record<string, string> = {
    RETURNED: "Belum diperbaiki",
    IN_PROGRESS: "Perbaikan masih draft",
    FIELD_CORRECTION_SUBMITTED: "Perbaikan sudah dikirim",
    FIELD_PENDING: "Menunggu keputusan lapangan",
    APPROVED: "Selesai",
    OPEN: "Menjadi temuan",
    PENDING: "Belum diperiksa",
    VALID: "Valid",
    INVALID: "Tidak valid",
  };
  return labels[text] || text.replaceAll("_", " ");
};

export function AssessmentWorkflowPanel(props: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const { workspace, user, myAssignment } = props;
  const isAuditee =
    user.roles?.includes("AUDITEE") && workspace.unitId === user.unitId;

  if (workspace.status !== "FIELD_AUDIT") {
    return <ExistingPanel {...props} />;
  }

  if (isAssignedAuditor(myAssignment)) {
    return <AuditorCorrectionMonitor {...props} />;
  }

  if (isAuditee) {
    return <AuditeeCorrectionSubmit {...props} />;
  }

  return <ExistingPanel {...props} />;
}

function useAssessmentFlow(workspaceId: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await api(`/audit-flow/workspaces/${workspaceId}/assessment-flow`);
      setData(payload);
      setError("");
      return payload;
    } catch (reason: any) {
      setError(reason.message || "Data assessment lapangan gagal dimuat.");
      return null;
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    const refresh = (event: Event) => {
      const id = (event as CustomEvent)?.detail?.workspaceId;
      if (!id || id === workspaceId) load();
    };
    window.addEventListener("sami:evidence-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("sami:evidence-changed", refresh);
    };
  }, [workspaceId]);

  return { data, error, load };
}

function AuditeeCorrectionSubmit(props: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const { workspace, busy, run } = props;
  const { data, error, load } = useAssessmentFlow(workspace.id);
  const [message, setMessage] = useState("");
  const questions = data?.questions || [];
  const inProgress = questions.filter(
    (question: any) => question.assessment?.responseStatus === "IN_PROGRESS",
  ).length;
  const submitted = questions.filter(
    (question: any) =>
      question.assessment?.responseStatus === "FIELD_CORRECTION_SUBMITTED",
  ).length;

  async function notifyAuditors() {
    setMessage("");
    const ok = await run(
      `/audit-flow/workspaces/${workspace.id}/field-corrections/submit`,
      { method: "POST", body: "{}" },
      "Pemberitahuan perbaikan dikirim kepada Auditor dan Ketua Auditor.",
    );
    if (ok) {
      setMessage("Auditor telah diberi notifikasi bahwa perbaikan siap diperiksa.");
      await load();
    }
  }

  const signature = questions
    .map(
      (question: any) =>
        `${question.id}:${question.assessment?.responseStatus}:${question.assessment?.updatedAt}:${(question.evidences || []).length}`,
    )
    .join("|");

  return (
    <div className="field-correction-wrapper">
      <section className="ami-panel correction-notice">
        <div className="ami-panel-title">
          <div>
            <h2>Perbaikan saat Assessment Lapangan</h2>
            <p>
              Simpan perbaikan pada setiap butir. Tombol kirim hanya memberi
              notifikasi kepada tim audit; Auditor tetap dapat menetapkan hasil
              berdasarkan pemeriksaan lapangan meskipun perbaikan belum lengkap.
            </p>
          </div>
          <span className="ami-pill">
            {inProgress} draft · {submitted} sudah dikirim
          </span>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        <div className="notice-actions">
          <span>
            {inProgress
              ? `${inProgress} perbaikan tersimpan dapat diberitahukan kepada Auditor.`
              : "Tidak ada draft perbaikan baru untuk diberitahukan."}
          </span>
          <button
            type="button"
            className="primary"
            disabled={busy || inProgress === 0}
            onClick={notifyAuditors}
          >
            Kirim Pemberitahuan ke Auditor
          </button>
        </div>
      </section>

      <ExistingPanel key={signature || "auditee-field"} {...props} />

      <style jsx>{`
        .field-correction-wrapper { display: grid; gap: 1rem; }
        .notice-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; padding: .8rem; border-radius: 12px; background: #eff6ff; }
      `}</style>
    </div>
  );
}

function AuditorCorrectionMonitor(props: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const { workspace, busy, run } = props;
  const { data, error, load } = useAssessmentFlow(workspace.id);
  const [message, setMessage] = useState("");
  const questions = data?.questions || [];
  const corrections = questions.filter((question: any) =>
    ["RETURNED", "IN_PROGRESS", "FIELD_CORRECTION_SUBMITTED"].includes(
      question.assessment?.responseStatus || "",
    ),
  );

  const signature = useMemo(
    () =>
      questions
        .map(
          (question: any) =>
            `${question.id}:${question.assessment?.responseStatus}:${question.assessment?.updatedAt}:${(question.evidences || [])
              .map((evidence: any) => `${evidence.id}-${evidence.reviewStatus}`)
              .join(",")}`,
        )
        .join("|"),
    [questions],
  );

  async function reviewEvidence(
    evidence: any,
    decision: "VALID" | "INVALID",
  ) {
    let note = decision === "VALID" ? "Bukti perbaikan sesuai." : "";
    if (decision === "INVALID") {
      note =
        window.prompt(
          "Alasan bukti perbaikan tidak valid",
          evidence.validationNote || "",
        ) || "";
      if (!note.trim()) return;
    }
    setMessage("");
    const ok = await run(
      `/audit-flow/assessment-evidences/${evidence.id}/review`,
      { method: "PATCH", body: JSON.stringify({ decision, note }) },
      decision === "VALID"
        ? "Bukti perbaikan dinyatakan Valid."
        : "Bukti perbaikan dinyatakan Tidak Valid.",
    );
    if (ok) {
      setMessage(
        decision === "VALID"
          ? "Bukti perbaikan dinyatakan Valid."
          : "Bukti perbaikan dinyatakan Tidak Valid.",
      );
      await load();
    }
  }

  return (
    <div className="field-correction-wrapper">
      <section className="ami-panel">
        <div className="ami-panel-title">
          <div>
            <h2>Perbaikan Auditee yang Dapat Diperiksa</h2>
            <p>
              Jawaban terbaru dimuat otomatis setiap tiga detik. Status pengiriman
              hanya informasi. Auditor tetap boleh menetapkan hasil lapangan ketika
              Auditee belum atau tidak mampu melengkapi perbaikan.
            </p>
          </div>
          <button type="button" className="small" onClick={load}>
            Muat Ulang Sekarang
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        <div className="correction-list">
          {corrections.length ? (
            corrections.map((question: any) => {
              const assessment = question.assessment || {};
              return (
                <article className="correction-card" key={question.id}>
                  <header>
                    <div>
                      <small>
                        {question.masterQuestion?.code} · Butir {question.sortOrder}
                      </small>
                      <h3>{question.publishedQuestion || question.questionSnapshot}</h3>
                    </div>
                    <span className="ami-pill">
                      {statusLabel(assessment.responseStatus)}
                    </span>
                  </header>

                  <div className="return-note">
                    <b>Catatan pengembalian</b>
                    <p>{assessment.returnNote || "—"}</p>
                  </div>

                  <div className="answer-grid">
                    <div>
                      <b>Jawaban terbaru Auditee</b>
                      <p>{assessment.implementationDescription || "Belum ada perbaikan."}</p>
                    </div>
                    <div>
                      <b>Keterangan bukti terbaru</b>
                      <p>{assessment.evidenceSummary || "—"}</p>
                    </div>
                    <div>
                      <b>Kendala Auditee</b>
                      <p>{assessment.constraintNote || "—"}</p>
                    </div>
                  </div>

                  <section className="evidence-list">
                    <div className="subheading">
                      <b>Lampiran terkait</b>
                      <span>{(question.evidences || []).length} dokumen</span>
                    </div>
                    {(question.evidences || []).length ? (
                      question.evidences.map((evidence: any) => (
                        <div className="evidence-row" key={evidence.id}>
                          <div>
                            <b>{evidence.title || evidence.fileName}</b>
                            <small>
                              {statusLabel(evidence.reviewStatus)}
                              {evidence.validationNote
                                ? ` · ${evidence.validationNote}`
                                : ""}
                            </small>
                          </div>
                          <EvidenceFileLinks evidence={evidence} compact />
                          <div className="evidence-actions">
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
                        </div>
                      ))
                    ) : (
                      <span className="muted">Belum ada lampiran perbaikan.</span>
                    )}
                  </section>

                  <div className="decision-note">
                    Auditor dapat menetapkan hasil lapangan sekarang berdasarkan
                    kondisi aktual, bukti yang tersedia, dan hasil wawancara.
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty">Tidak ada butir yang sedang diperbaiki Auditee.</div>
          )}
        </div>
      </section>

      <section className="decision-guide">
        <b>Langkah Auditor:</b> baca hasil perbaikan di atas, lalu gunakan tombol
        <b> Tetapkan Hasil Lapangan</b> pada daftar butir di bawah. Tombol tersebut
        tetap aktif tanpa menunggu pengiriman Auditee.
      </section>

      <ExistingPanel key={signature || "auditor-field"} {...props} />

      <style jsx>{`
        .field-correction-wrapper { display: grid; gap: 1rem; }
        .correction-list { display: grid; gap: .85rem; margin-top: 1rem; }
        .correction-card { display: grid; gap: .8rem; padding: 1rem; border: 1px solid #dbe4ee; border-radius: 14px; background: #fff; }
        .correction-card > header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        .correction-card h3 { margin: .25rem 0; }
        .return-note { padding: .75rem; border-radius: 10px; background: #fff7ed; }
        .return-note p { margin: .25rem 0 0; white-space: pre-wrap; }
        .answer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .7rem; }
        .answer-grid > div { padding: .75rem; border-radius: 10px; background: #f8fafc; }
        .answer-grid p { margin: .25rem 0 0; white-space: pre-wrap; }
        .evidence-list { display: grid; gap: .55rem; }
        .subheading { display: flex; justify-content: space-between; gap: .7rem; }
        .evidence-row { display: flex; align-items: center; flex-wrap: wrap; gap: .6rem; padding: .7rem; border: 1px solid #dbe4ee; border-radius: 10px; }
        .evidence-row > div:first-child { display: grid; gap: .15rem; flex: 1 1 260px; }
        .evidence-row small { color: #64748b; }
        .evidence-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
        .decision-note, .decision-guide { padding: .8rem; border-radius: 10px; background: #ecfdf5; color: #166534; }
        @media (max-width: 850px) {
          .answer-grid { grid-template-columns: 1fr; }
          .correction-card > header { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
