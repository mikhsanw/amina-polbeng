"use client";

import { useEffect, useMemo, useState } from "react";
import { API, api } from "../lib/api";

type Filters = {
  year: string;
  programId: string;
  unitId: string;
  moduleCode: string;
};

const initialFilters: Filters = {
  year: "",
  programId: "",
  unitId: "",
  moduleCode: "",
};

const label = (value: unknown) =>
  String(value ?? "—")
    .replaceAll("_", " ")
    .replace("KTS MAYOR", "KTS/NC MAYOR")
    .replace("KTS MINOR", "KTS/NC MINOR");

const percent = (value: unknown) => `${Number(value || 0).toFixed(1)}%`;

const dateLabel = (value: unknown) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(String(value)));
};

function queryString(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function InstitutionalRecapView() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api(`/institutional-recap${queryString(filters)}`));
    } catch (reason: any) {
      setError(reason.message || "Rekap institusi gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.year, filters.programId, filters.unitId, filters.moduleCode]);

  async function download(type: "xlsx" | "pdf") {
    setDownloading(type);
    setError("");
    try {
      const response = await fetch(
        `${API}/institutional-recap/export.${type}${queryString(filters)}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Ekspor gagal dibuat.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        type === "xlsx"
          ? "Rekap_Institusi_SAMI_NONAK.xlsx"
          : "Rekap_Institusi_SAMI_NONAK.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason: any) {
      setError(reason.message || "Ekspor gagal dibuat.");
    } finally {
      setDownloading("");
    }
  }

  const maxFinding = useMemo(
    () => Math.max(1, ...(data?.findingsByUnit || []).map((row: any) => row.total)),
    [data],
  );

  if (loading && !data) {
    return <div className="institutional-empty">Memuat analisis institusi…</div>;
  }

  const kpis = data?.kpis || {};
  const availablePrograms = (data?.filters?.programs || []).filter(
    (program: any) => !filters.year || String(program.auditYear) === filters.year,
  );

  return (
    <div className="institutional-recap">
      <div className="institutional-heading">
        <div>
          <h1>Rekap Institusi</h1>
          <p>
            Analisis lintas unit atas temuan, CAPA, unsur dominan, rekomendasi
            Auditor, dan prioritas rencana kerja perbaikan.
          </p>
        </div>
        <div className="institutional-actions">
          <button
            type="button"
            onClick={() => download("xlsx")}
            disabled={Boolean(downloading)}
          >
            {downloading === "xlsx" ? "Membuat Excel…" : "Ekspor Excel"}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => download("pdf")}
            disabled={Boolean(downloading)}
          >
            {downloading === "pdf" ? "Membuat PDF…" : "Ekspor PDF"}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="institutional-filter-panel">
        <label>
          Tahun audit
          <select
            value={filters.year}
            onChange={(event) =>
              setFilters({
                ...filters,
                year: event.target.value,
                programId: "",
              })
            }
          >
            <option value="">Semua tahun</option>
            {(data?.filters?.years || []).map((year: number) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          Program audit
          <select
            value={filters.programId}
            onChange={(event) =>
              setFilters({ ...filters, programId: event.target.value })
            }
          >
            <option value="">Semua program</option>
            {availablePrograms.map((program: any) => (
              <option key={program.id} value={program.id}>
                {program.auditYear} · {program.code} · {program.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unit
          <select
            value={filters.unitId}
            onChange={(event) =>
              setFilters({ ...filters, unitId: event.target.value })
            }
          >
            <option value="">Semua unit</option>
            {(data?.filters?.units || []).map((unit: any) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} · {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unsur / modul
          <select
            value={filters.moduleCode}
            onChange={(event) =>
              setFilters({ ...filters, moduleCode: event.target.value })
            }
          >
            <option value="">Semua unsur</option>
            {(data?.filters?.modules || []).map((moduleCode: string) => (
              <option key={moduleCode} value={moduleCode}>
                {moduleCode}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="reset-filter"
          disabled={!Object.values(filters).some(Boolean)}
          onClick={() => setFilters(initialFilters)}
        >
          Reset filter
        </button>
      </section>

      <section className="institutional-kpis">
        <Kpi title="Unit diaudit" value={kpis.unitsAudited || 0} note="workspace terpilih" />
        <Kpi title="Butir audit" value={kpis.totalQuestions || 0} note="dasar normalisasi" />
        <Kpi title="Total temuan" value={kpis.totalFindings || 0} note={`${kpis.openFindings || 0} masih terbuka`} />
        <Kpi title="CAPA efektif" value={kpis.capaEffective || 0} note={`dari ${kpis.capaTotal || 0} CAPA`} />
        <Kpi title="CAPA terlambat" value={kpis.capaOverdue || 0} note="melewati target" danger={Number(kpis.capaOverdue || 0) > 0} />
        <Kpi title="Progres rata-rata" value={percent(kpis.avgCapaProgress)} note="seluruh CAPA" />
        <Kpi title="Tingkat efektivitas" value={percent(kpis.closureRate)} note="CAPA efektif / total" />
        <Kpi title="Temuan ditutup" value={kpis.closedFindings || 0} note="selesai atau ditutup" />
      </section>

      <section className="institutional-grid two">
        <article className="institutional-card">
          <div className="card-heading">
            <div>
              <h2>Temuan per unit</h2>
              <p>Jumlah mentah disandingkan dengan rasio per butir audit.</p>
            </div>
          </div>
          <div className="finding-bars">
            {(data?.findingsByUnit || []).length ? (
              data.findingsByUnit.map((row: any) => (
                <div className="finding-bar-row" key={row.workspaceId}>
                  <div className="bar-label">
                    <b>{row.unitCode}</b>
                    <span>{row.unitName}</span>
                  </div>
                  <div className="bar-track" title={`${row.total} temuan`}>
                    <span
                      className="bar-segment major"
                      style={{ width: `${(row.major / maxFinding) * 100}%` }}
                    />
                    <span
                      className="bar-segment minor"
                      style={{ width: `${(row.minor / maxFinding) * 100}%` }}
                    />
                    <span
                      className="bar-segment observation"
                      style={{ width: `${(row.observation / maxFinding) * 100}%` }}
                    />
                  </div>
                  <div className="bar-value">
                    <b>{row.total}</b>
                    <small>{percent(row.findingRate)}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="institutional-empty">Belum ada temuan pada filter ini.</div>
            )}
          </div>
          <div className="chart-legend">
            <span><i className="major" />Mayor</span>
            <span><i className="minor" />Minor</span>
            <span><i className="observation" />OBS/OFI</span>
          </div>
        </article>

        <article className="institutional-card">
          <div className="card-heading">
            <div>
              <h2>Status CAPA</h2>
              <p>Komposisi tindak lanjut dan perhatian terhadap keterlambatan.</p>
            </div>
          </div>
          <div className="capa-status-list">
            {(data?.capaByStatus || []).length ? (
              data.capaByStatus.map((row: any) => {
                const total = Math.max(1, Number(kpis.capaTotal || 0));
                return (
                  <div className="capa-status-row" key={row.status}>
                    <div>
                      <b>{row.label}</b>
                      <span>{row.count} CAPA</span>
                    </div>
                    <div className="capa-track">
                      <span style={{ width: `${(row.count / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="institutional-empty">Belum ada CAPA pada filter ini.</div>
            )}
          </div>
        </article>
      </section>

      <section className="institutional-card heatmap-card">
        <div className="card-heading">
          <div>
            <h2>Heatmap unsur × unit</h2>
            <p>Sel yang lebih pekat menunjukkan konsentrasi temuan lebih tinggi.</p>
          </div>
        </div>
        <div className="institutional-table-wrap">
          <table className="institutional-table heatmap-table">
            <thead>
              <tr>
                <th>Unsur</th>
                {(data?.heatmap?.units || []).map((unit: any) => (
                  <th key={unit.id} title={unit.name}>{unit.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.heatmap?.rows || []).map((row: any) => (
                <tr key={row.moduleCode}>
                  <th>{row.moduleCode}</th>
                  {(data?.heatmap?.units || []).map((unit: any) => {
                    const cell = row.cells.find((item: any) => item.unitId === unit.id) || { count: 0, open: 0, major: 0 };
                    const strength = cell.count / Math.max(1, data.heatmap.maxCount);
                    return (
                      <td
                        key={unit.id}
                        style={{
                          backgroundColor: cell.count
                            ? `rgba(15, 76, 110, ${0.12 + strength * 0.78})`
                            : undefined,
                          color: strength > 0.52 ? "white" : undefined,
                        }}
                        title={`${unit.name}: ${cell.count} temuan, ${cell.open} terbuka, ${cell.major} mayor`}
                      >
                        <b>{cell.count}</b>
                        {cell.open > 0 && <small>{cell.open} terbuka</small>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="institutional-grid two">
        <article className="institutional-card">
          <div className="card-heading">
            <div>
              <h2>Progres tindak lanjut per unit</h2>
              <p>Progres rata-rata, CAPA efektif, dan CAPA terlambat.</p>
            </div>
          </div>
          <div className="unit-progress-list">
            {(data?.unitProgress || []).map((row: any) => (
              <div className="unit-progress-row" key={row.workspaceId}>
                <div className="progress-title">
                  <b>{row.unitCode}</b>
                  <span>{row.capaEffective}/{row.capaTotal} efektif · {row.capaOverdue} terlambat</span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${Math.min(100, row.avgProgress)}%` }} />
                </div>
                <strong>{percent(row.avgProgress)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="institutional-card">
          <div className="card-heading">
            <div>
              <h2>CAPA terlambat</h2>
              <p>Daftar prioritas yang sudah melewati tanggal target.</p>
            </div>
            <span className="count-badge">{data?.overdueCapa?.length || 0}</span>
          </div>
          <div className="institutional-table-wrap compact">
            <table className="institutional-table">
              <thead>
                <tr>
                  <th>Temuan</th>
                  <th>Unit</th>
                  <th>Terlambat</th>
                  <th>Progres</th>
                </tr>
              </thead>
              <tbody>
                {(data?.overdueCapa || []).length ? (
                  data.overdueCapa.map((row: any) => (
                    <tr key={row.id}>
                      <td>
                        <b>{row.findingCode}</b>
                        <small>{row.moduleCode} · {label(row.findingType)}</small>
                      </td>
                      <td>{row.unitCode}</td>
                      <td><span className="danger-text">{row.daysLate} hari</span></td>
                      <td>{percent(row.progressPercent)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4}>Tidak ada CAPA terlambat.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="institutional-card">
        <div className="card-heading">
          <div>
            <h2>Analisis Auditor dan arah rekomendasi</h2>
            <p>Analisis berasal dari kertas kerja; arah rekomendasi menghubungkan kesenjangan dengan CAPA.</p>
          </div>
          <span className="count-badge">{data?.auditorInsights?.length || 0}</span>
        </div>
        <div className="insight-list">
          {(data?.auditorInsights || []).length ? (
            data.auditorInsights.map((row: any) => (
              <details className="insight-card" key={row.findingId}>
                <summary>
                  <span>
                    <b>{row.findingCode}</b>
                    <small>{row.unitCode} · {row.moduleCode} · {label(row.findingType)}</small>
                  </span>
                  <span className="status-pill">{label(row.status)}</span>
                </summary>
                <div className="insight-grid">
                  <div><b>Kondisi</b><p>{row.condition}</p></div>
                  <div><b>Dampak / risiko</b><p>{row.riskImpact}</p></div>
                  <div><b>Analisis Auditor</b><p>{row.auditorAnalysis}</p><small>{row.auditorName}</small></div>
                  <div><b>Arah rekomendasi</b><p>{row.recommendation}</p><small>CAPA: {label(row.capaStatus)} · {percent(row.progressPercent)}</small></div>
                </div>
              </details>
            ))
          ) : (
            <div className="institutional-empty">Belum ada analisis Auditor pada filter ini.</div>
          )}
        </div>
      </section>

      <section className="institutional-card">
        <div className="card-heading">
          <div>
            <h2>Matriks rencana kerja perbaikan</h2>
            <p>Prioritas otomatis berdasarkan temuan mayor, keterlambatan, temuan terbuka, dan sebaran lintas unit.</p>
          </div>
          <span className="count-badge">{data?.workPlan?.length || 0}</span>
        </div>
        <div className="institutional-table-wrap">
          <table className="institutional-table work-plan-table">
            <thead>
              <tr>
                <th>Prioritas</th>
                <th>Unsur</th>
                <th>Unit terdampak</th>
                <th>Temuan</th>
                <th>Rencana perbaikan</th>
                <th>Indikator keberhasilan</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {(data?.workPlan || []).length ? (
                data.workPlan.map((row: any) => (
                  <tr key={row.moduleCode}>
                    <td><span className={`priority ${row.priority.toLowerCase()}`}>{row.priority}</span></td>
                    <td><b>{row.moduleCode}</b></td>
                    <td>{row.affectedUnits.join(", ")}</td>
                    <td>
                      {row.findingCount} total<br />
                      <small>{row.openCount} terbuka · {row.majorCount} mayor · {row.overdueCount} terlambat</small>
                    </td>
                    <td>{row.recommendedAction}</td>
                    <td>{row.successIndicator}</td>
                    <td>{dateLabel(row.targetDate)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7}>Belum ada temuan untuk disusun menjadi rencana kerja.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="institutional-footer">
        Data diperbarui dari kondisi sistem pada {dateLabel(data?.generatedAt)}. Semua visual mengikuti filter aktif.
      </footer>
    </div>
  );
}

function Kpi({
  title,
  value,
  note,
  danger = false,
}: {
  title: string;
  value: string | number;
  note: string;
  danger?: boolean;
}) {
  return (
    <article className={`institutional-kpi ${danger ? "danger" : ""}`}>
      <span>{title}</span>
      <b>{value}</b>
      <small>{note}</small>
    </article>
  );
}
