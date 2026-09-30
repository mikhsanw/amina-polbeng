"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EvidenceFileLinks } from "./EvidenceFileLinks";
import { AssessmentWorkflowPanel as ExistingPanel } from "./AssessmentWorkflowPanelV2";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const label = (value: unknown) =>
  String(value ?? "—").replaceAll("_", " ");

export function AssessmentWorkflowPanel(props: {
  workspace: any;
  user: any;
  myAssignment?: string;
  busy: boolean;
  run: RunAction;
}) {
  const { workspace } = props;
  const [evidences, setEvidences] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/audit-flow/workspaces/${workspace.id}/assessment-flow`)
      .then((payload) => {
        setEvidences(Array.isArray(payload?.evidences) ? payload.evidences : []);
        setError("");
      })
      .catch((reason: any) =>
        setError(reason.message || "Daftar dokumen bukti gagal dimuat."),
      );
  }, [workspace.id, workspace.updatedAt, workspace.status]);

  return (
    <div className="assessment-with-files">
      <section className="ami-panel evidence-library-panel">
        <div className="ami-panel-title">
          <div>
            <h2>Dokumen Bukti Auditee</h2>
            <p>
              Auditor dapat membuka file asli sebelum memvalidasi bukti atau
              menetapkan hasil assessment lapangan.
            </p>
          </div>
          <span className="ami-pill">{evidences.length} file</span>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="evidence-library-list">
          {evidences.length ? (
            evidences.map((evidence: any) => (
              <article className="evidence-library-row" key={evidence.id}>
                <div>
                  <small>
                    {evidence.auditQuestion?.sortOrder
                      ? `Butir ${evidence.auditQuestion.sortOrder}`
                      : "Bukti umum"}
                    {evidence.uploadedBy?.fullName
                      ? ` · ${evidence.uploadedBy.fullName}`
                      : ""}
                  </small>
                  <b>{evidence.title || evidence.fileName}</b>
                  <span>
                    {evidence.fileName} · {label(evidence.reviewStatus)}
                  </span>
                </div>
                <EvidenceFileLinks evidence={evidence} />
              </article>
            ))
          ) : (
            <div className="empty">Belum ada dokumen bukti yang diunggah.</div>
          )}
        </div>
      </section>

      <ExistingPanel {...props} />

      <style jsx>{`
        .assessment-with-files {
          display: grid;
          gap: 1rem;
        }
        .evidence-library-list {
          display: grid;
          gap: 0.65rem;
          margin-top: 1rem;
        }
        .evidence-library-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem;
          border: 1px solid #dbe4ee;
          border-radius: 12px;
          background: #fff;
        }
        .evidence-library-row > div {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
        }
        .evidence-library-row small,
        .evidence-library-row span {
          color: #64748b;
        }
        .evidence-library-row b {
          overflow-wrap: anywhere;
        }
        @media (max-width: 720px) {
          .evidence-library-row {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
