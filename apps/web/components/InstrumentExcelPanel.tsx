"use client";

import { useState } from "react";
import { API } from "../lib/api";

export function InstrumentExcelPanel({ onImported }: { onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function upload() {
    if (!file) return setError("Pilih file Excel terlebih dahulu.");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API}/master-admin/questions/import`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "Impor Excel gagal.");
      setResult(body);
      if (body.imported > 0) onImported?.();
    } catch (reason: any) {
      setError(reason.message || "Impor Excel gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel instrument-excel-panel">
      <div>
        <h2>Tambah atau Perbarui melalui Excel</h2>
        <p>
          Unduh template yang sudah berisi bank soal saat ini, tambahkan baris baru
          atau perbarui baris lama, lalu unggah kembali. Sheet referensi dan unit
          ikut dibaca sebelum pertanyaan diproses.
        </p>
      </div>
      <div className="excel-actions">
        <a className="link-button" href={`${API}/master/questions/template`}>
          Unduh Template Berisi Data Saat Ini
        </a>
        <label className="excel-file">
          <span>{file?.name || "Pilih file .xlsx"}</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <button className="primary fit" disabled={busy || !file} onClick={upload}>
          {busy ? "Mengimpor…" : "Unggah dan Validasi"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {result && (
        <div className={`import-result ${result.ok ? "success" : "partial"}`}>
          <b>{result.imported} baris pertanyaan berhasil diproses</b>
          <span>
            {result.created} baru · {result.updated} diperbarui · {result.rejected}{" "}
            ditolak
          </span>
          {result.references && (
            <span>
              Referensi: {result.references.processed} diproses, {result.references.created}{" "}
              baru, {result.references.updated} diperbarui
            </span>
          )}
          {result.units && (
            <span>
              Unit: {result.units.processed} diproses, {result.units.created} baru,{" "}
              {result.units.updated} diperbarui
            </span>
          )}
          {result.errors?.length > 0 && (
            <details>
              <summary>Lihat kesalahan impor</summary>
              <ul>
                {result.errors.map((item: any, index: number) => (
                  <li key={`${item.sheet || "sheet"}-${item.row}-${item.code}-${index}`}>
                    {item.sheet ? `${item.sheet}, ` : ""}baris {item.row} ({item.code || "tanpa kode"}):{" "}
                    {item.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <style jsx>{`
        .instrument-excel-panel {
          display: grid;
          gap: 1rem;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #f8fbff, #eef6ff);
          border-color: #bfdbfe;
        }
        .instrument-excel-panel h2 {
          margin: 0 0 0.35rem;
        }
        .instrument-excel-panel p {
          margin: 0;
          color: #475569;
          max-width: 850px;
        }
        .excel-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .excel-file {
          display: flex;
          align-items: center;
          min-width: 260px;
          min-height: 42px;
          padding: 0 0.9rem;
          border: 1px dashed #94a3b8;
          border-radius: 10px;
          background: #fff;
          cursor: pointer;
        }
        .excel-file input {
          display: none;
        }
        .excel-file span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .import-result {
          display: grid;
          gap: 0.25rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
        }
        .import-result.success {
          background: #ecfdf5;
          color: #166534;
        }
        .import-result.partial {
          background: #fff7ed;
          color: #9a3412;
        }
        .import-result ul {
          margin: 0.6rem 0 0;
          padding-left: 1.2rem;
          color: #7f1d1d;
        }
      `}</style>
    </section>
  );
}
