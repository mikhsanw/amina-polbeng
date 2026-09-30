"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function UnitManagementView() {
  const [units, setUnits] = useState<any[]>([]);
  const [unitForm, setUnitForm] = useState<any>({ active: true });
  const [functionForm, setFunctionForm] = useState<any>({ active: true });
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setError("");
    try {
      const result = await api("/master/units");
      const rows = Array.isArray(result) ? result : result?.data || [];
      setUnits(rows);
      if (
        selectedUnitId &&
        !rows.some((unit: any) => unit.id === selectedUnitId)
      ) {
        setSelectedUnitId("");
      }
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(
    () =>
      units.filter((unit) =>
        `${unit.code} ${unit.name} ${unit.slug}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [units, query],
  );
  const unitSort = useSortableRows(
    shown.map((unit) => ({
      ...unit,
      functionCount: unit.functions?.length || 0,
    })),
    "name",
  );
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);

  async function saveUnit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      code: String(unitForm.code || "")
        .trim()
        .toUpperCase(),
      name: String(unitForm.name || "").trim(),
      slug: String(unitForm.slug || slugify(unitForm.name || "")).trim(),
      active: unitForm.active !== false,
    };
    try {
      if (unitForm.id) {
        await api(`/master-admin/units/${unitForm.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/master/units", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setUnitForm({ active: true });
      setShowUnitForm(false);
      setMessage("Data unit berhasil disimpan.");
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  async function deactivateUnit(unit: any) {
    if (!confirm(`Nonaktifkan unit ${unit.code} — ${unit.name}?`)) return;
    setError("");
    try {
      await api(`/master-admin/units/${unit.id}`, { method: "DELETE" });
      setMessage(
        `Unit ${unit.code} dinonaktifkan tanpa menghapus riwayat audit.`,
      );
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  async function saveFunction(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUnit) return;
    setError("");
    setMessage("");
    const payload = {
      code: String(functionForm.code || "")
        .trim()
        .toUpperCase(),
      description: String(functionForm.description || "").trim(),
      sourceRef: String(functionForm.sourceRef || "").trim() || null,
      riskLevel:
        String(functionForm.riskLevel || "")
          .trim()
          .toUpperCase() || null,
      active: functionForm.active !== false,
    };
    try {
      if (functionForm.id) {
        await api(`/master-admin/unit-functions/${functionForm.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/master-admin/units/${selectedUnit.id}/functions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setFunctionForm({ active: true });
      setMessage("Tupoksi unit berhasil disimpan.");
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  async function deactivateFunction(item: any) {
    if (!confirm(`Nonaktifkan tupoksi ${item.code}?`)) return;
    try {
      await api(`/master-admin/unit-functions/${item.id}`, {
        method: "DELETE",
      });
      setMessage(`Tupoksi ${item.code} dinonaktifkan.`);
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Unit &amp; Tupoksi</h1>
          <p>
            Kelola struktur unit, status, dan fungsi yang menjadi dasar pemetaan
            instrumen.
          </p>
        </div>
        <button
          className="primary fit"
          onClick={() => {
            setUnitForm({ active: true });
            setShowUnitForm((current) => !current);
          }}
        >
          + Tambah Unit
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {showUnitForm && (
        <form className="panel form-panel" onSubmit={saveUnit}>
          <h2>{unitForm.id ? "Edit Unit" : "Tambah Unit"}</h2>
          <div className="form-row">
            <label>
              Kode unit
              <input
                required
                value={unitForm.code || ""}
                onChange={(event) =>
                  setUnitForm({
                    ...unitForm,
                    code: event.target.value.toUpperCase(),
                  })
                }
              />
            </label>
            <label>
              Nama unit
              <input
                required
                value={unitForm.name || ""}
                onChange={(event) => {
                  const name = event.target.value;
                  setUnitForm({
                    ...unitForm,
                    name,
                    slug: unitForm.id ? unitForm.slug : slugify(name),
                  });
                }}
              />
            </label>
          </div>
          <label>
            Slug penyimpanan
            <input
              required
              value={unitForm.slug || ""}
              onChange={(event) =>
                setUnitForm({ ...unitForm, slug: event.target.value })
              }
            />
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={unitForm.active !== false}
              onChange={(event) =>
                setUnitForm({ ...unitForm, active: event.target.checked })
              }
            />
            <span>Unit aktif</span>
          </label>
          <div className="actions">
            <button className="primary fit">Simpan Unit</button>
            <button type="button" onClick={() => setShowUnitForm(false)}>
              Batal
            </button>
          </div>
        </form>
      )}

      <section className="panel module">
        <div className="toolbar">
          <input
            placeholder="Cari kode atau nama unit..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button onClick={load}>Muat ulang</button>
          <span className="count">{shown.length} unit</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <SortableTh
                  label="Kode"
                  column="code"
                  sort={unitSort.sort}
                  onSort={unitSort.toggle}
                />
                <SortableTh
                  label="Nama Unit"
                  column="name"
                  sort={unitSort.sort}
                  onSort={unitSort.toggle}
                />
                <SortableTh
                  label="Jumlah Tupoksi"
                  column="functionCount"
                  sort={unitSort.sort}
                  onSort={unitSort.toggle}
                />
                <SortableTh
                  label="Status"
                  column="active"
                  sort={unitSort.sort}
                  onSort={unitSort.toggle}
                />
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {unitSort.sorted.map((unit) => (
                <tr key={unit.id}>
                  <td>{unit.code}</td>
                  <td>
                    <b>{unit.name}</b>
                    <br />
                    <small>{unit.slug}</small>
                  </td>
                  <td>{unit.functionCount}</td>
                  <td>
                    <span className="badge">
                      {unit.active ? "AKTIF" : "NONAKTIF"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="small"
                      onClick={() => setSelectedUnitId(unit.id)}
                    >
                      Kelola Tupoksi
                    </button>{" "}
                    <button
                      className="small"
                      onClick={() => {
                        setUnitForm({ ...unit });
                        setShowUnitForm(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>{" "}
                    {unit.active && (
                      <button
                        className="danger small"
                        onClick={() => deactivateUnit(unit)}
                      >
                        Nonaktifkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!unitSort.sorted.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    Belum ada unit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedUnit && (
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>
                Tupoksi {selectedUnit.code} — {selectedUnit.name}
              </h2>
              <small>
                Fungsi aktif dapat dipakai untuk pemetaan standar dan instrumen.
              </small>
            </div>
            <button onClick={() => setSelectedUnitId("")}>Tutup</button>
          </div>

          <form className="form-panel compact" onSubmit={saveFunction}>
            <div className="form-row">
              <label>
                Kode fungsi
                <input
                  required
                  value={functionForm.code || ""}
                  onChange={(event) =>
                    setFunctionForm({
                      ...functionForm,
                      code: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label>
                Tingkat risiko
                <select
                  value={functionForm.riskLevel || ""}
                  onChange={(event) =>
                    setFunctionForm({
                      ...functionForm,
                      riskLevel: event.target.value,
                    })
                  }
                >
                  <option value="">Tidak ditetapkan</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </label>
            </div>
            <label>
              Pernyataan tupoksi
              <textarea
                required
                value={functionForm.description || ""}
                onChange={(event) =>
                  setFunctionForm({
                    ...functionForm,
                    description: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Sumber/rujukan
              <input
                value={functionForm.sourceRef || ""}
                onChange={(event) =>
                  setFunctionForm({
                    ...functionForm,
                    sourceRef: event.target.value,
                  })
                }
              />
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={functionForm.active !== false}
                onChange={(event) =>
                  setFunctionForm({
                    ...functionForm,
                    active: event.target.checked,
                  })
                }
              />
              <span>Tupoksi aktif</span>
            </label>
            <div className="actions">
              <button className="primary fit">
                {functionForm.id ? "Perbarui Tupoksi" : "Tambah Tupoksi"}
              </button>
              {functionForm.id && (
                <button
                  type="button"
                  onClick={() => setFunctionForm({ active: true })}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Pernyataan Tupoksi</th>
                  <th>Sumber</th>
                  <th>Risiko</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(selectedUnit.functions || []).map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.description}</td>
                    <td>{item.sourceRef || "—"}</td>
                    <td>{item.riskLevel || "—"}</td>
                    <td>
                      <span className="badge">
                        {item.active ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="small"
                        onClick={() => setFunctionForm({ ...item })}
                      >
                        Edit
                      </button>{" "}
                      {item.active && (
                        <button
                          className="danger small"
                          onClick={() => deactivateFunction(item)}
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!selectedUnit.functions?.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Belum ada tupoksi untuk unit ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
