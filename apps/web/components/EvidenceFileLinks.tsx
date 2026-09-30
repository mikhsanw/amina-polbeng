"use client";

import { API } from "../lib/api";

function formatBytes(value: unknown) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceFileLinks({
  evidence,
  compact = false,
}: {
  evidence: any;
  compact?: boolean;
}) {
  if (!evidence?.id) return null;
  const base = `${API}/audit-flow/evidences/${evidence.id}/file`;

  return (
    <span className={`evidence-file-links ${compact ? "compact" : ""}`}>
      {!compact && (
        <small className="evidence-file-meta">
          {[evidence.fileName, formatBytes(evidence.fileSizeBytes)]
            .filter(Boolean)
            .join(" · ")}
        </small>
      )}
      <span className="evidence-file-actions">
        <a href={base} target="_blank" rel="noreferrer">
          Lihat file
        </a>
        <a href={`${base}?download=1`}>Unduh</a>
      </span>
      <style jsx>{`
        .evidence-file-links {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.45rem 0.75rem;
          margin-top: 0.4rem;
        }
        .evidence-file-links.compact {
          display: inline-flex;
          justify-content: flex-start;
          margin-left: 0.45rem;
          margin-top: 0;
        }
        .evidence-file-meta {
          color: #64748b;
        }
        .evidence-file-actions {
          display: inline-flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .evidence-file-actions a {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0.25rem 0.6rem;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.78rem;
          font-weight: 700;
          text-decoration: none;
        }
        .evidence-file-actions a:hover {
          background: #dbeafe;
        }
      `}</style>
    </span>
  );
}
