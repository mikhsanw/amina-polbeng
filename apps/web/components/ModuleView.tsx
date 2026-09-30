"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";

const config: any = {
  "audit-programs": {
    title: "Rencana Audit",
    sub: "Periode dan program Audit Mutu Internal",
    endpoint: "/audit-programs",
  },
  "audit-workspaces": {
    title: "Registry Audit",
    sub: "Seluruh workspace audit per unit dan tahun",
    endpoint: "/audit-workspaces",
  },
  questions: {
    title: "Telaah Instrumen",
    sub: "Bank pertanyaan hasil sinkronisasi Google Sheet",
    endpoint: "/legacy/questions?limit=100",
  },
  "self-assessment": {
    title: "Penilaian Mandiri",
    sub: "Jawaban auditee terhadap instrumen yang diterbitkan",
    endpoint: "/legacy/assessments",
  },
  evidences: {
    title: "Bukti Audit",
    sub: "Registry dokumen dan bukti objektif",
    endpoint: "/legacy/evidences",
  },
  workpapers: {
    title: "Kertas Kerja Auditor",
    sub: "Analisis, sampel, dan simpulan auditor",
    endpoint: "/legacy/workpapers",
  },
  findings: {
    title: "Temuan Audit",
    sub: "Ketidaksesuaian, observasi, dan peluang perbaikan",
    endpoint: "/legacy/findings",
  },
  "corrective-actions": {
    title: "Tindak Lanjut (CAPA)",
    sub: "Koreksi, akar masalah, dan tindakan korektif",
    endpoint: "/legacy/actions",
  },
  verifications: {
    title: "Verifikasi Efektivitas",
    sub: "Validasi penyelesaian tindak lanjut",
    endpoint: "/legacy/actions",
  },
  users: {
    title: "Pengguna & Role",
    sub: "Akun, unit, dan hak akses sistem",
    endpoint: "/users",
  },
  units: {
    title: "Unit & Tupoksi",
    sub: "Struktur organisasi Politeknik Negeri Bengkalis",
    endpoint: "/master/units",
  },
  standards: {
    title: "Standar Audit",
    sub: "Standar dan klausul acuan audit",
    endpoint: "/master/standards",
  },
  "activity-logs": {
    title: "Log Sistem",
    sub: "Jejak aktivitas penting aplikasi",
    endpoint: "/activity-logs",
  },
  reports: {
    title: "Dokumen Cetak",
    sub: "Dokumen audit siap rekap dan cetak",
    endpoint: "/audit-workspaces",
  },
  recap: {
    title: "Rekap Institusi",
    sub: "Ringkasan pelaksanaan audit seluruh unit",
    endpoint: "/audit-workspaces",
  },
};
const val = (x: any, ...keys: string[]) => {
  for (const k of keys) {
    let v: any = x;
    for (const p of k.split(".")) v = v?.[p];
    if (v !== undefined && v !== null && v !== "")
      return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return "—";
};
function columns(section: string) {
  if (section === "questions")
    return [
      ["Kode", "code"],
      ["Modul", "moduleCode"],
      ["Pertanyaan", "question"],
      ["Standar", "standard.title"],
      ["Bobot", "weight"],
    ];
  if (section === "users")
    return [
      ["Nama", "fullName"],
      ["Username", "username"],
      ["Unit", "unit.name"],
      ["Status", "status"],
    ];
  if (section === "units")
    return [
      ["Kode", "code"],
      ["Nama Unit", "name"],
      ["Slug", "slug"],
      ["Status", "active"],
    ];
  if (section === "standards")
    return [
      ["Kode", "code"],
      ["Standar", "title"],
      ["Jenis", "standardType"],
      ["Sumber", "source"],
      ["Status", "active"],
    ];
  if (section === "audit-programs")
    return [
      ["Kode", "code"],
      ["Program", "name"],
      ["Tahun", "auditYear"],
      ["Mulai", "startDate"],
      ["Selesai", "endDate"],
      ["Status", "status"],
    ];
  if (["audit-workspaces", "reports", "recap"].includes(section))
    return [
      ["Workspace", "name"],
      ["Unit", "unit.name"],
      ["Tahun", "auditYear"],
      ["Instrumen", "instrumentStatus"],
      ["Status", "status"],
      ["Pertanyaan", "_count.questions"],
    ];
  if (section === "self-assessment")
    return [
      ["Unit", "question.workspace.unit.name"],
      ["Pertanyaan", "question.questionSnapshot"],
      ["Uraian Pelaksanaan", "implementationDescription"],
      ["Hasil", "standardResult"],
      ["Kesesuaian Proses", "processResult"],
      ["Status", "responseStatus"],
      ["Diajukan", "submittedAt"],
    ];
  if (section === "evidences")
    return [
      ["Kode", "code"],
      ["Judul", "title"],
      ["Unit", "workspace.unit.name"],
      ["Jenis", "evidenceType"],
      ["Status", "reviewStatus"],
      ["Pengunggah", "uploadedBy.fullName"],
    ];
  if (section === "workpapers")
    return [
      ["Unit", "question.workspace.unit.name"],
      ["Pertanyaan", "question.questionSnapshot"],
      ["Auditor", "auditor.fullName"],
      ["Hasil", "standardResult"],
      ["Hasil Proses", "processResult"],
      ["Status Dokumen", "documentStatus"],
      ["Analisis", "auditorAnalysis"],
    ];
  if (section === "findings")
    return [
      ["Kode", "code"],
      ["Unit", "workspace.unit.name"],
      ["Jenis", "findingType"],
      ["Kondisi", "condition"],
      ["Risiko", "riskImpact"],
      ["Status", "status"],
    ];
  if (["corrective-actions", "verifications"].includes(section))
    return [
      ["Temuan", "finding.code"],
      ["Unit", "workspace.unit.name"],
      ["Tindakan", "correctiveAction"],
      ["Target", "targetDate"],
      ["Progres", "progressPercent"],
      ["Status", "status"],
    ];
  return [
    ["Waktu", "createdAt"],
    ["Aksi", "action"],
    ["Entitas", "entityType"],
    ["ID", "entityId"],
  ];
}
export function ModuleView({ section, user }: { section: string; user: any }) {
  const searchParams = useSearchParams();
  const c = config[section] || config["audit-workspaces"];
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<any>(null);
  const load = () => {
    setLoading(true);
    api(c.endpoint)
      .then((x) => setRows(Array.isArray(x) ? x : x.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [c.endpoint]);
  const shown = useMemo(() => {
    const task = searchParams.get("task");
    return rows.filter((row) => {
      const matchesSearch = JSON.stringify(row)
        .toLowerCase()
        .includes(q.toLowerCase());
      if (!matchesSearch || section !== "audit-workspaces" || !task)
        return matchesSearch;
      if (task === "instrument")
        return ["AUDITOR_REVIEW", "RETURNED"].includes(row.instrumentStatus);
      if (task === "verification")
        return row.instrumentStatus === "PENDING_VERIFICATION";
      if (task === "assessment") return row.status === "SELF_ASSESSMENT";
      if (task === "workpaper")
        return ["DESK_REVIEW", "AUDIT", "FIELDWORK", "FIELD_AUDIT"].includes(
          row.status,
        );
      if (task === "findings")
        return (
          (row._count?.findings || 0) > 0 ||
          ["FOLLOW_UP", "REPORTING"].includes(row.status)
        );
      return true;
    });
  }, [rows, q, section, searchParams]);
  const cols = columns(section);
  const workspaceSection = ["audit-workspaces", "reports", "recap"].includes(
    section,
  );
  const rowSort = useSortableRows(shown, cols[0]?.[1] || "");
  async function instrument(x: any) {
    try {
      await api(`/audit-workspaces/${x.id}/generate-instrument`, {
        method: "POST",
      });
      location.href = `/audit-workspaces/${x.id}`;
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{c.title}</h1>
          <p>{c.sub}</p>
        </div>
        <span className="count">{rows.length} data</span>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="panel module">
        <div className="toolbar">
          <input
            placeholder="Cari pada data..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={load}>Muat ulang</button>
        </div>
        {loading ? (
          <div className="empty">Memuat data…</div>
        ) : shown.length === 0 ? (
          <div className="empty">Belum ada data pada modul ini.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {cols.map((x: any) => (
                    <SortableTh
                      key={x[0]}
                      label={x[0]}
                      column={x[1]}
                      sort={rowSort.sort}
                      onSort={rowSort.toggle}
                    />
                  ))}
                  {workspaceSection && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {rowSort.sorted.map((x, i) => (
                  <tr key={x.id || i} onClick={() => setSelected(x)}>
                    {cols.map((col: any) => (
                      <td key={col[1]}>
                        <span className={/status/i.test(col[1]) ? "badge" : ""}>
                          {val(x, col[1])}
                        </span>
                      </td>
                    ))}
                    {workspaceSection && (
                      <td>
                        <a
                          className="small link-button"
                          href={
                            section === "reports"
                              ? `/audit-print/${x.id}`
                              : `/audit-workspaces/${x.id}`
                          }
                          target={section === "reports" ? "_blank" : undefined}
                          rel={section === "reports" ? "noreferrer" : undefined}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {section === "reports"
                            ? "Buka laporan"
                            : section === "recap"
                              ? "Lihat audit"
                              : "Buka transaksi"}
                        </a>{" "}
                        {section === "audit-workspaces" &&
                          x._count?.questions === 0 && (
                            <button
                              className="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                instrument(x);
                              }}
                            >
                              Bentuk instrumen
                            </button>
                          )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && section !== "audit-workspaces" && (
        <div className="drawer">
          <button className="close" onClick={() => setSelected(null)}>
            ×
          </button>
          <h2>Detail Data</h2>
          {cols.map((col: any) => (
            <div className="detail" key={col[1]}>
              <label>{col[0]}</label>
              <span>{val(selected, col[1])}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
