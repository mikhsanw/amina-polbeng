"use client";

import { useEffect, useMemo, useState } from "react";
import { API, api } from "../lib/api";

const statusLabel = (value: unknown) => {
  const text = String(value || "PENDING");
  if (text === "PENDING") return "Belum diperiksa Admin Mutu";
  if (text === "VALID") return "Valid";
  if (text === "INVALID") return "Perlu diperbaiki";
  return text.replaceAll("_", " ");
};

export function SignedReportLibraryView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/audit-flow/signed-reports");
      setRows(Array.isArray(data) ? data : []);
    } catch (reason: any) {
      setError(reason.message || "Daftar laporan gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.title,
        row.fileName,
        row.workspace?.unit?.code,
        row.workspace?.unit?.name,
        row.workspace?.program?.code,
        row.workspace?.program?.name,
        row.workspace?.auditYear,
        row.uploadedBy?.fullName,
        statusLabel(row.reviewStatus),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, query]);

  return (
    <section className="signed-report-library">
      <div className="page-title">
        <div>
          <h1>Laporan</h1>
          <p>
            Dokumen laporan final yang telah ditandatangani dan diunggah melalui
            Archive.
          </p>
        </div>
        <span className="count">{rows.length} dokumen</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel report-library-panel">
        <div className="toolbar">
          <input
            placeholder="Cari unit, program, tahun, atau nama laporan..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" onClick={load}>
            Muat ulang
          </button>
        </div>

        {loading ? (
          <div className="empty">Memuat laporan…</div>
        ) : shown.length === 0 ? (
          <div className="empty">
            Belum ada laporan final yang diunggah melalui Archive.
          </div>
        ) : (
          <div className="report-grid">
            {shown.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-card-head">
                  <div>
                    <small>
                      {report.workspace?.unit?.code || "UNIT"} · Tahun{" "}
                      {report.workspace?.auditYear || "—"}
                    </small>
                    <a
                      className="report-title"
                      href={`${API}/audit-flow/evidences/${report.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {report.title || report.fileName}
                    </a>
                  </div>
                  <span
                    className={`report-status ${String(
                      report.reviewStatus || "PENDING",
                    ).toLowerCase()}`}
                  >
                    {statusLabel(report.reviewStatus)}
                  </span>
                </div>

                <dl>
                  <div>
                    <dt>Unit</dt>
                    <dd>{report.workspace?.unit?.name || "—"}</dd>
                  </div>
                  <div>
                    <dt>Program</dt>
                    <dd>
                      {report.workspace?.program?.code || "—"} ·{" "}
                      {report.workspace?.program?.name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Pengunggah</dt>
                    <dd>{report.uploadedBy?.fullName || "—"}</dd>
                  </div>
                  <div>
                    <dt>Tanggal unggah</dt>
                    <dd>
                      {report.uploadedAt
                        ? new Date(report.uploadedAt).toLocaleString("id-ID")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Nama file</dt>
                    <dd>{report.fileName || "—"}</dd>
                  </div>
                  {report.validationNote && (
                    <div>
                      <dt>Catatan Admin Mutu</dt>
                      <dd>{report.validationNote}</dd>
                    </div>
                  )}
                </dl>

                <div className="report-actions">
                  <a
                    className="primary-link"
                    href={`${API}/audit-flow/evidences/${report.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka Laporan
                  </a>
                  <a
                    href={`${API}/audit-flow/evidences/${report.id}/file?download=1`}
                  >
                    Unduh PDF
                  </a>
                  <a href={`/audit-workspaces/${report.workspaceId}?tab=archive`}>
                    Buka Archive Unit
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .signed-report-library {
          display: grid;
          gap: 1rem;
        }
        .report-library-panel {
          display: grid;
          gap: 1rem;
        }
        .report-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .report-card {
          display: grid;
          gap: 0.9rem;
          padding: 1rem;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 5px 16px rgba(15, 23, 42, 0.05);
        }
        .report-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.8rem;
        }
        .report-card-head > div {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
        }
        .report-card small {
          color: #64748b;
          font-weight: 700;
        }
        .report-title {
          color: #1d4ed8;
          font-size: 1rem;
          font-weight: 850;
          line-height: 1.35;
          text-decoration: none;
          overflow-wrap: anywhere;
        }
        .report-title:hover {
          text-decoration: underline;
        }
        .report-status {
          flex: 0 0 auto;
          padding: 0.35rem 0.55rem;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .report-status.valid {
          background: #dcfce7;
          color: #166534;
        }
        .report-status.invalid {
          background: #fee2e2;
          color: #991b1b;
        }
        dl {
          display: grid;
          gap: 0.5rem;
          margin: 0;
        }
        dl > div {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 0.7rem;
        }
        dt {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 700;
        }
        dd {
          margin: 0;
          color: #334155;
          overflow-wrap: anywhere;
        }
        .report-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }
        .report-actions a {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0.35rem 0.7rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 750;
          text-decoration: none;
        }
        .report-actions .primary-link {
          border-color: #2563eb;
          background: #2563eb;
          color: #fff;
        }
        @media (max-width: 900px) {
          .report-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .report-card-head {
            flex-direction: column;
          }
          dl > div {
            grid-template-columns: 1fr;
            gap: 0.15rem;
          }
        }
      `}</style>
    </section>
  );
}
