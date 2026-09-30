"use client";

import { AnnualUnitPlanEditor, PlanEditorState } from "./AnnualUnitPlanEditor";

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function missingRequirements(plan: any): string[] {
  if (plan.included === false) return [];
  const assignments = plan.assignments || [];
  const missing: string[] = [];
  if (!(plan._count?.questions || 0)) missing.push("instrumen");
  if (!assignments.some((item: any) => item.role === "LEAD_AUDITOR")) {
    missing.push("Ketua Auditor");
  }
  if (!assignments.some((item: any) => item.role === "AUDITOR")) {
    missing.push("Auditor");
  }
  if (!assignments.some((item: any) => item.role === "VERIFIER")) {
    missing.push("Verifikator");
  }
  if (!(plan.instrumentReviewStart && plan.instrumentReviewEnd)) {
    missing.push("jadwal review instrumen");
  }
  if (!(plan.selfAssessmentStart && plan.selfAssessmentEnd)) {
    missing.push("jadwal self-assessment");
  }
  if (!(plan.fieldAuditStart && plan.fieldAuditEnd)) {
    missing.push("jadwal audit lapangan");
  }
  return missing;
}

export function AnnualUnitPlanMatrix({
  rows,
  selectedProgramId,
  editingPlanId,
  editor,
  candidates,
  availableQuestions,
  busyUnitId,
  onOpenEditor,
  onCloseEditor,
  onSave,
  onCreateWorkspace,
  onOpenWorkspace,
  setEditor,
}: {
  rows: any[];
  selectedProgramId: string;
  editingPlanId: string;
  editor: PlanEditorState | null;
  candidates: any[];
  availableQuestions: any[];
  busyUnitId: string;
  onOpenEditor: (plan: any) => void;
  onCloseEditor: () => void;
  onSave: (plan: any) => void;
  onCreateWorkspace: (plan: any) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  setEditor: (value: PlanEditorState) => void;
}) {
  return (
    <div className="unit-card-grid">
      {rows.map((plan: any) => {
        const lead = plan.assignments?.find(
          (item: any) => item.role === "LEAD_AUDITOR",
        );
        const auditors = plan.assignments?.filter(
          (item: any) => item.role === "AUDITOR",
        );
        const verifier = plan.assignments?.find(
          (item: any) => item.role === "VERIFIER",
        );
        const missing = missingRequirements(plan);
        const isEditing = editingPlanId === plan.id;
        const isBusy = busyUnitId === plan.id;

        return (
          <article
            className={`unit-plan-card ${plan.included === false ? "excluded" : ""} ${isEditing ? "editing" : ""}`}
            key={plan.id}
          >
            <header className="unit-card-header">
              <div>
                <span className="unit-code">{plan.unit.code}</span>
                <h3>{plan.unit.name}</h3>
              </div>
              <span className={`badge ${plan.ready ? "" : "warning"}`}>
                {plan.workspace?.status || plan.status}
              </span>
            </header>

            {plan.included === false ? (
              <div className="excluded-note">Unit tidak dimasukkan sebagai target audit.</div>
            ) : (
              <>
                <div className="summary-grid">
                  <div className="summary-item">
                    <small>Instrumen dipilih</small>
                    <b>{plan._count?.questions || 0} butir</b>
                    <span>Default unit: {plan.defaultInstrumentCount || 0}</span>
                  </div>
                  <div className="summary-item">
                    <small>Ketua Auditor</small>
                    <b>{lead?.user?.fullName || "Belum dipilih"}</b>
                  </div>
                  <div className="summary-item">
                    <small>Auditor</small>
                    <b>
                      {auditors?.length
                        ? auditors.map((item: any) => item.user?.fullName).join(", ")
                        : "Belum dipilih"}
                    </b>
                  </div>
                  <div className="summary-item">
                    <small>Verifikator</small>
                    <b>{verifier?.user?.fullName || "Belum dipilih"}</b>
                  </div>
                </div>

                <div className="schedule-grid">
                  <div>
                    <small>Review instrumen</small>
                    <span>
                      {dateInput(plan.instrumentReviewStart) || "-"} s.d. {dateInput(plan.instrumentReviewEnd) || "-"}
                    </span>
                  </div>
                  <div>
                    <small>Self-assessment</small>
                    <span>
                      {dateInput(plan.selfAssessmentStart) || "-"} s.d. {dateInput(plan.selfAssessmentEnd) || "-"}
                    </span>
                  </div>
                  <div>
                    <small>Audit lapangan</small>
                    <span>
                      {dateInput(plan.fieldAuditStart) || "-"} s.d. {dateInput(plan.fieldAuditEnd) || "-"}
                    </span>
                  </div>
                </div>

                {!plan.ready && !plan.workspace && (
                  <div className="missing-box">
                    <b>Belum lengkap:</b>
                    <div className="missing-chips">
                      {missing.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="card-actions">
              {plan.workspace ? (
                <button
                  className="primary fit"
                  onClick={() => onOpenWorkspace(plan.workspace.id)}
                >
                  Buka Audit
                </button>
              ) : selectedProgramId ? (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => (isEditing ? onCloseEditor() : onOpenEditor(plan))}
                  >
                    {isEditing ? "Tutup Editor" : plan.ready ? "Edit Rencana" : "Lengkapi Rencana"}
                  </button>
                  {plan.ready && (
                    <button
                      className="primary fit"
                      disabled={isBusy}
                      onClick={() => onCreateWorkspace(plan)}
                    >
                      {isBusy ? "Membentuk…" : "Bentuk Ruang Kerja"}
                    </button>
                  )}
                </>
              ) : (
                <span className="muted">Buat atau pilih program terlebih dahulu.</span>
              )}
            </div>

            {isEditing && editor && (
              <div className="editor-slot">
                <AnnualUnitPlanEditor
                  plan={plan}
                  candidates={candidates}
                  editor={editor}
                  setEditor={setEditor}
                  questions={availableQuestions}
                  busy={isBusy}
                  onSave={() => onSave(plan)}
                  onCancel={onCloseEditor}
                />
              </div>
            )}
          </article>
        );
      })}

      {!rows.length && (
        <div className="empty-matrix">Belum ada unit aktif untuk ditampilkan.</div>
      )}

      <style jsx>{`
        .unit-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        .unit-plan-card {
          min-width: 0;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          padding: 1rem;
          background: white;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
        }
        .unit-plan-card.editing {
          grid-column: 1 / -1;
        }
        .unit-plan-card.excluded {
          opacity: 0.7;
        }
        .unit-card-header,
        .card-actions {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .unit-card-header h3 {
          margin: 0.25rem 0 0;
          font-size: 1.05rem;
        }
        .unit-code {
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #475569;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .summary-item,
        .schedule-grid > div {
          min-width: 0;
          padding: 0.75rem;
          border-radius: 9px;
          background: #f8fafc;
        }
        .summary-item small,
        .summary-item b,
        .summary-item span,
        .schedule-grid small,
        .schedule-grid span {
          display: block;
        }
        .summary-item b {
          margin-top: 0.2rem;
          overflow-wrap: anywhere;
        }
        .summary-item span,
        .schedule-grid span {
          margin-top: 0.2rem;
          color: #64748b;
          font-size: 0.82rem;
        }
        .schedule-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
          margin-top: 0.75rem;
        }
        .missing-box,
        .excluded-note {
          margin-top: 0.8rem;
          padding: 0.75rem;
          border-radius: 9px;
          background: #fff7ed;
          color: #9a3412;
        }
        .missing-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.45rem;
        }
        .missing-chips span {
          padding: 0.2rem 0.45rem;
          border-radius: 999px;
          background: white;
          border: 1px solid #fed7aa;
          font-size: 0.75rem;
        }
        .card-actions {
          justify-content: flex-start;
          margin-top: 1rem;
        }
        .editor-slot {
          margin-top: 1rem;
        }
        .empty-matrix {
          padding: 1rem;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          color: #64748b;
        }
        @media (max-width: 700px) {
          .unit-card-grid,
          .summary-grid,
          .schedule-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
