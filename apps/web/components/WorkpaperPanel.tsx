"use client";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const label = (value: unknown) => {
  const text = String(value ?? "—");
  if (text === "BELUM_DIUKUR") return "BELUM DIUKUR";
  if (text === "KTS_MINOR") return "KTS/NC MINOR";
  if (text === "KTS_MAYOR") return "KTS/NC MAYOR";
  return text.replaceAll("_", " ");
};

export function WorkpaperPanel({
  workspace,
  data,
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
  const workpapers = data.workpapers || [];
  const publishedQuestions = (data.questions || []).filter(
    (question: any) => question.reviewStatus === "PUBLISHED" && !question.excluded,
  );
  const finalQuestionIds = new Set(
    workpapers
      .filter((item: any) =>
        ["APPROVED", "LOCKED"].includes(item.documentStatus),
      )
      .map((item: any) => item.auditQuestionId),
  );
  const missingFinal = publishedQuestions.filter(
    (question: any) => !finalQuestionIds.has(question.id),
  ).length;
  const myDrafts = workpapers.filter(
    (item: any) =>
      item.auditorUserId === user.id &&
      ["DRAFT", "RETURNED"].includes(item.documentStatus),
  ).length;
  const submitted = workpapers.filter(
    (item: any) => item.documentStatus === "SUBMITTED",
  ).length;
  const draftFindings = (data.findings || []).filter((item: any) =>
    ["DRAFT", "REVIEW"].includes(item.status),
  ).length;
  const isLead = myAssignment === "LEAD_AUDITOR";
  const reportingReady = missingFinal === 0 && draftFindings === 0;

  return (
    <section className="ami-panel">
      <div className="ami-panel-title">
        <div>
          <h2>Kertas Kerja Auditor</h2>
          <p>
            Satu butir assessment lapangan menghasilkan satu kertas kerja. Dokumen
            dibuat otomatis, lalu diajukan Auditor dan disahkan Ketua Auditor.
          </p>
        </div>
        <span className="ami-pill">
          {finalQuestionIds.size}/{publishedQuestions.length} final
        </span>
      </div>

      <div className="workflow-note">
        <b>Urutan kerja</b>
        <span>
          Assessment lapangan → kertas kerja otomatis → Ajukan → Setujui →
          Selesaikan Pelaporan.
        </span>
      </div>

      {workspace.status === "REPORTING" && (
        <div className="workpaper-stage-actions">
          {myDrafts > 0 && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() =>
                run(
                  `/audit-flow/workspaces/${workspace.id}/workpapers/submit-all`,
                  { method: "POST", body: "{}" },
                  `${myDrafts} kertas kerja diajukan kepada Ketua Auditor.`,
                )
              }
            >
              Ajukan Semua Kertas Kerja Saya ({myDrafts})
            </button>
          )}
          {isLead && submitted > 0 && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() =>
                run(
                  `/audit-flow/workspaces/${workspace.id}/workpapers/approve-all`,
                  { method: "POST", body: "{}" },
                  `${submitted} kertas kerja disetujui.`,
                )
              }
            >
              Setujui Semua yang Diajukan ({submitted})
            </button>
          )}
          {isLead && (
            <button
              type="button"
              className="primary complete-reporting"
              disabled={busy || !reportingReady}
              onClick={() =>
                run(
                  `/audit-flow/workspaces/${workspace.id}/reporting/complete`,
                  { method: "POST", body: "{}" },
                  "Pelaporan selesai dan proses berlanjut.",
                )
              }
            >
              Selesaikan Pelaporan
            </button>
          )}
          {!reportingReady && (
            <span className="readiness-warning">
              Belum siap: {missingFinal} butir belum mempunyai kertas kerja final dan{" "}
              {draftFindings} temuan masih draft.
            </span>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table className="ami-table">
          <thead>
            <tr>
              <th>Pertanyaan</th>
              <th>Auditor</th>
              <th>Hasil</th>
              <th>Bukti dan analisis</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {workpapers.length ? (
              workpapers.map((item: any) => (
                <tr key={item.id}>
                  <td>{item.question?.questionSnapshot || "—"}</td>
                  <td>{item.auditor?.fullName || "—"}</td>
                  <td>
                    <span className="ami-pill">
                      {label(
                        item.standardResult ||
                          item.processResult ||
                          item.auditStatus,
                      )}
                    </span>
                  </td>
                  <td>
                    <details>
                      <summary>Lihat dasar pemeriksaan</summary>
                      <div className="workpaper-detail">
                        <b>Sampel / narasumber</b>
                        <p>
                          {[item.sampleDescription, item.interviewee]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                        <b>Bukti objektif</b>
                        <p>{item.objectiveEvidence || "—"}</p>
                        <b>Analisis Auditor</b>
                        <p>{item.auditorAnalysis || "—"}</p>
                        {item.reviewNote && (
                          <>
                            <b>Catatan pengembalian</b>
                            <p>{item.reviewNote}</p>
                          </>
                        )}
                      </div>
                    </details>
                  </td>
                  <td>{label(item.documentStatus)}</td>
                  <td>
                    <div className="ami-actions">
                      {item.auditorUserId === user.id &&
                        ["DRAFT", "RETURNED"].includes(item.documentStatus) && (
                          <button
                            type="button"
                            className="small primary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                `/audit-flow/workpapers/${item.id}/submit`,
                                { method: "POST" },
                                "Kertas kerja diajukan kepada Ketua Auditor.",
                              )
                            }
                          >
                            Ajukan
                          </button>
                        )}
                      {isLead && item.documentStatus === "SUBMITTED" && (
                        <>
                          <button
                            type="button"
                            className="small primary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                `/audit-flow/workpapers/${item.id}/approve`,
                                { method: "POST" },
                                "Kertas kerja disetujui.",
                              )
                            }
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            className="small danger"
                            disabled={busy}
                            onClick={() => {
                              const note = window.prompt(
                                "Catatan pengembalian kertas kerja",
                              );
                              if (note?.trim())
                                run(
                                  `/audit-flow/workpapers/${item.id}/return`,
                                  {
                                    method: "POST",
                                    body: JSON.stringify({ note: note.trim() }),
                                  },
                                  "Kertas kerja dikembalikan kepada Auditor.",
                                );
                            }}
                          >
                            Kembalikan
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  Belum ada kertas kerja. Setiap butir akan muncul setelah Auditor
                  menyimpan hasil assessment lapangan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .workflow-note {
          display: grid;
          gap: 0.25rem;
          margin: 1rem 0;
          padding: 0.85rem 1rem;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
          color: #334155;
        }
        .workpaper-stage-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: .6rem;
          margin-bottom: 1rem;
          padding: .85rem;
          border: 1px solid #dbe4ee;
          border-radius: 12px;
          background: #f8fafc;
        }
        .complete-reporting { margin-left: auto; }
        .readiness-warning { color: #9a3412; font-weight: 700; }
        details summary {
          color: #1d4ed8;
          cursor: pointer;
          font-weight: 700;
        }
        .workpaper-detail {
          min-width: 260px;
          margin-top: 0.55rem;
          padding: 0.75rem;
          border-radius: 10px;
          background: #f8fafc;
        }
        .workpaper-detail b {
          display: block;
          margin-top: 0.4rem;
          color: #334155;
        }
        .workpaper-detail p {
          margin: 0.2rem 0 0.5rem;
          white-space: pre-wrap;
        }
        @media (max-width: 720px) {
          .complete-reporting { margin-left: 0; }
        }
      `}</style>
    </section>
  );
}
