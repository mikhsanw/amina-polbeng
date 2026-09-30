"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const currentYear = new Date().getFullYear();
const label = (value: unknown) =>
  String(value ?? "—").replaceAll("_", " ");

function formatDate(value: unknown) {
  if (!value) return "Belum ada";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Belum ada"
    : date.toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export function ActivityEvaluationView() {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api(`/activity-evaluation?year=${year}`)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((reason: any) => setError(reason.message));
  }, [year]);

  const roles = useMemo(
    () => [
      ...new Set<string>(
        (data?.rows || []).flatMap((row: any) => row.roles || []),
      ),
    ].sort(),
    [data],
  );

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data?.rows || []).filter((row: any) => {
      if (role !== "ALL" && !row.roles.includes(role)) return false;
      if (status !== "ALL" && row.activityStatus !== status) return false;
      if (!keyword) return true;
      return [
        row.fullName,
        row.username,
        row.unit?.name,
        row.roles.join(" "),
        row.assignedUnits.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [data, query, role, status]);

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Evaluasi Keaktifan Pengguna</h1>
          <p>
            Rekap tindakan, penugasan, aktivitas terakhir, dan tenggat yang
            terlewati. Data ini menjadi bahan evaluasi Pimpinan, bukan skor otomatis.
          </p>
        </div>
        <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(
            (item) => (
              <option key={item} value={item}>Tahun {item}</option>
            ),
          )}
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <section className="cards">
          <Metric name="Pengguna" value={data.summary.users} />
          <Metric name="Mendapat penugasan" value={data.summary.assignedUsers} />
          <Metric name="Melakukan tindakan" value={data.summary.activeUsers} />
          <Metric
            name="Tenggat terlewati"
            value={data.summary.usersWithMissedDeadlines}
          />
        </section>
      )}

      <section className="panel">
        <div className="activity-filter-grid">
          <input
            placeholder="Cari nama, username, unit, atau role…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="ALL">Semua role</option>
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">Semua status aktivitas</option>
            {[
              "SANGAT_AKTIF",
              "AKTIF",
              "TERBATAS",
              "BELUM_AKTIF",
              "PERLU_PERHATIAN",
              "TIDAK_DITUGASKAN",
            ].map((item) => <option key={item}>{label(item)}</option>)}
          </select>
        </div>

        {!data ? (
          <div className="empty">Memuat evaluasi keaktifan…</div>
        ) : (
          <div className="table-wrap">
            <table className="table activity-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Penugasan</th>
                  <th>Tindakan</th>
                  <th>Rincian aktivitas</th>
                  <th>Aktivitas terakhir</th>
                  <th>Tenggat terlewati</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row: any) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.fullName}</b><br />
                      <small>{row.username} · {row.unit?.name || "Tanpa unit"}</small><br />
                      <small>{row.roles.map(label).join(" · ")}</small>
                    </td>
                    <td>
                      <b>{row.assignedWorkspaces}</b> ruang kerja<br />
                      <small>{row.assignmentRoles.map(label).join(" · ") || "—"}</small>
                    </td>
                    <td><b>{row.actionCount}</b></td>
                    <td>
                      <small>
                        Instrumen {row.actionCounts.instrument}<br />
                        Self/bukti {row.actionCounts.selfAssessment}<br />
                        Lapangan {row.actionCounts.fieldAudit}<br />
                        Kertas kerja/tindak lanjut {row.actionCounts.followUp}
                      </small>
                    </td>
                    <td>{formatDate(row.lastActivity)}</td>
                    <td>
                      <b>{row.missedDeadlines}</b>
                      {row.missedDeadlines > 0 && <><br /><small>Fallback otomatis tercatat</small></>}
                    </td>
                    <td><span className="badge">{label(row.activityStatus)}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={7}>Tidak ada pengguna sesuai filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Metric({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="card">
      <div className="metric">{String(value ?? 0)}</div>
      <div className="label">{name}</div>
    </div>
  );
}
