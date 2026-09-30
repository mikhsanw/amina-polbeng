"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { API, api } from "../lib/api";

type RunAction = (
  path: string,
  init?: RequestInit,
  success?: string,
) => Promise<boolean>;

const statusLabel = (value: unknown) => {
  const text = String(value || "PENDING");
  if (text === "PENDING") return "Belum diperiksa";
  if (text === "VALID") return "Valid";
  if (text === "INVALID") return "Tidak valid";
  return text.replaceAll("_", " ");
};

export function ArchivePanel({
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("Laporan AMI Bertanda Tangan");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setData(await api(`/audit-flow/workspaces/${workspace.id}/archive`));
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Dokumen Archive gagal dimuat.");
    }
  };

  useEffect(() => {
    load();
  }, [workspace.id]);

  const documents = data?.documents || [];
  const canUpload =
    ["FOLLOW_UP", "REPORT_REVIEW"].includes(workspace.status) &&
    (user.roles?.some((role: string) =>
      ["SUPER_ADMIN", "ADMIN_MUTU"].includes(role),
    ) || ["AUDITOR", "LEAD_AUDITOR"].includes(myAssignment || ""));
  const canReview = user.roles?.some((role: string) =>
    ["SUPER_ADMIN", "ADMIN_MUTU"].includes(role),
  );
  const allValid = useMemo(
    () =>
      documents.length > 0 &&
      documents.every((document: any) => document.reviewStatus === "VALID"),
    [documents],
  );
  const canComplete =
    canReview &&
    workspace.status === "REPORT_REVIEW" &&
    allValid &&
    Number(data?.openFindings || 0) === 0;

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("title", title);
    setUploading(true);
    setError("");
    setMessage("");
    try {
      await api(`/audit-flow/workspaces/${workspace.id}/archive/upload`, {
        method: "POST",
        body: form,
      });
      setFile(null);
      setTitle("Laporan AMI Bertanda Tangan");
      setMessage("Dokumen Archive berhasil diunggah dan menunggu pemeriksaan Admin Mutu.");
      await load();
    } catch (reason: any) {
      setError(reason.message || "Unggah dokumen Archive gagal.");
    } finally {
      setUploading(false);
    }
  }

  async function review(document: any, decision: "VALID" | "INVALID") {
    let note = decision === "VALID"
      ? "Dokumen bertanda tangan lengkap dan dapat diarsipkan."
      : "";
    if (decision === "INVALID") {
      note = window.prompt(
        "Jelaskan bagian dokumen Archive yang harus diperbaiki",
        document.validationNote || "",
      ) || "";
      if (!note.trim()) return;
    }
    const ok = await run(
      `/audit-flow/archive-documents/${document.id}/review`,
      { method: "PATCH", body: JSON.stringify({ decision, note }) },
      decision === "VALID"
        ? "Dokumen Archive dinyatakan Valid."
        : "Dokumen Archive dikembalikan untuk diperbaiki.",
    );
    if (ok) await load();
  }

  async function remove(document: any) {
    if (!window.confirm(`Hapus dokumen ${document.title || document.fileName}?`)) return;
    const ok = await run(
      `/audit-flow/archive-documents/${document.id}`,
      { method: "DELETE" },
      "Dokumen Archive dihapus.",
    );
    if (ok) await load();
  }

  async function completeAudit() {
    const ok = await run(
      `/audit-flow/workspaces/${workspace.id}/close`,
      { method: "POST", body: "{}" },
      "Audit unit selesai dan ditutup.",
    );
    if (ok) await load();
  }

  return (
    <section className="ami-panel archive-panel">
      <div className="ami-panel-title">
        <div>
          <h2>Archive</h2>
          <p>
            Unggah laporan audit yang telah ditandatangani Auditee, Auditor, dan Ketua Auditor.
            Admin Mutu memeriksa dokumen sebelum audit unit ditutup.
          </p>
        </div>
        <span className="ami-pill">{documents.length} dokumen</span>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {canUpload && (
        <form className="archive-upload" onSubmit={upload}>
          <label>
            Nama dokumen
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            PDF bertanda tangan
            <input
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="primary" disabled={uploading || !file}>
            {uploading ? "Mengunggah…" : "Unggah ke Archive"}
          </button>
        </form>
      )}

      <div className="table-wrap">
        <table className="ami-table">
          <thead>
            <tr>
              <th>Dokumen</th>
              <th>Pengunggah</th>
              <th>Status</th>
              <th>Catatan Admin Mutu</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {documents.length ? (
              documents.map((document: any) => (
                <tr key={document.id}>
                  <td>
                    <a
                      className="archive-link"
                      href={`${API}/audit-flow/evidences/${document.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {document.title || document.fileName}
                    </a>
                    <small>{document.fileName}</small>
                  </td>
                  <td>{document.uploadedBy?.fullName || "—"}</td>
                  <td>{statusLabel(document.reviewStatus)}</td>
                  <td>{document.validationNote || "—"}</td>
                  <td>
                    <div className="ami-actions">
                      <a
                        className="small link-button"
                        href={`${API}/audit-flow/evidences/${document.id}/file?download=1`}
                      >
                        Unduh
                      </a>
                      {canReview && document.reviewStatus !== "VALID" && (
                        <button
                          type="button"
                          className="small primary"
                          disabled={busy}
                          onClick={() => review(document, "VALID")}
                        >
                          Nyatakan Valid
                        </button>
                      )}
                      {canReview && document.reviewStatus !== "INVALID" && (
                        <button
                          type="button"
                          className="small danger"
                          disabled={busy}
                          onClick={() => review(document, "INVALID")}
                        >
                          Tidak Valid
                        </button>
                      )}
                      {(document.reviewStatus !== "VALID" || canReview) &&
                        workspace.status !== "CLOSED" && (
                          <button
                            type="button"
                            className="small danger"
                            disabled={busy}
                            onClick={() => remove(document)}
                          >
                            Hapus
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>Belum ada laporan bertanda tangan di Archive.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canReview && workspace.status !== "CLOSED" && (
        <div className="archive-completion">
          <div>
            <b>Pemeriksaan akhir Admin Mutu</b>
            <span>
              {workspace.status === "FOLLOW_UP"
                ? "Dokumen dapat diperiksa sekarang, tetapi audit baru dapat ditutup setelah seluruh tindak lanjut selesai."
                : !documents.length
                  ? "Unggah minimal satu laporan bertanda tangan."
                  : !allValid
                    ? "Seluruh dokumen Archive harus berstatus Valid."
                    : Number(data?.openFindings || 0) > 0
                      ? `${data.openFindings} temuan masih terbuka.`
                      : "Archive lengkap dan audit siap ditutup."}
            </span>
          </div>
          {workspace.status === "REPORT_REVIEW" && (
            <button
              type="button"
              className="primary"
              disabled={busy || !canComplete}
              onClick={completeAudit}
            >
              Selesai Audit Unit Ini
            </button>
          )}
        </div>
      )}

      {workspace.status === "CLOSED" && (
        <div className="success">Audit unit telah selesai dan Archive dikunci.</div>
      )}

      <style jsx>{`
        .archive-panel { display: grid; gap: 1rem; }
        .archive-upload {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(260px, 1fr) auto;
          align-items: end;
          gap: .7rem;
          padding: .9rem;
          border: 1px solid #dbe4ee;
          border-radius: 12px;
          background: #f8fafc;
        }
        .archive-upload label { display: grid; gap: .35rem; font-weight: 700; }
        .archive-upload input { width: 100%; box-sizing: border-box; padding: .65rem; border: 1px solid #b8c7d9; border-radius: 8px; font: inherit; }
        .archive-link { display: block; color: #1d4ed8; font-weight: 800; text-decoration: none; }
        .archive-link:hover { text-decoration: underline; }
        td small { display: block; margin-top: .2rem; color: #64748b; }
        .archive-completion {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
        }
        .archive-completion > div { display: grid; gap: .25rem; }
        .archive-completion span { color: #475569; }
        @media (max-width: 900px) {
          .archive-upload { grid-template-columns: 1fr; }
          .archive-completion { align-items: stretch; flex-direction: column; }
        }
      `}</style>
    </section>
  );
}
