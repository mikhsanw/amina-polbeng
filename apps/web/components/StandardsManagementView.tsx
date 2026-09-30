"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";

export function StandardsManagementView() {
  const [standards, setStandards] = useState<any[]>([]);
  const [clauses, setClauses] = useState<any[]>([]);
  const [standardForm, setStandardForm] = useState<any>({
    active: true,
    standardType: "INTERNAL",
  });
  const [clauseForm, setClauseForm] = useState<any>({ active: true });
  const [openStandard, setOpenStandard] = useState(false);
  const [openClause, setOpenClause] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    try {
      const [standardData, clauseData] = await Promise.all([
        api("/master/standards"),
        api("/master/iso-clauses"),
      ]);
      setStandards(
        Array.isArray(standardData) ? standardData : standardData?.data || [],
      );
      setClauses(
        Array.isArray(clauseData) ? clauseData : clauseData?.data || [],
      );
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredStandards = useMemo(
    () =>
      standards.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
      ),
    [standards, query],
  );
  const filteredClauses = useMemo(
    () =>
      clauses.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
      ),
    [clauses, query],
  );
  const standardSort = useSortableRows(filteredStandards, "code");
  const clauseSort = useSortableRows(filteredClauses, "code");

  async function saveStandard(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        code: String(standardForm.code || "")
          .trim()
          .toUpperCase(),
        title: String(standardForm.title || "").trim(),
        source: String(standardForm.source || "").trim(),
        standardType: String(standardForm.standardType || "INTERNAL")
          .trim()
          .toUpperCase(),
        regulationReference:
          String(standardForm.regulationReference || "").trim() || null,
        description: String(standardForm.description || "").trim() || null,
        active: standardForm.active !== false,
      };
      await api(
        standardForm.id
          ? `/master-admin/standards/${standardForm.id}`
          : "/master-admin/standards",
        {
          method: standardForm.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setStandardForm({ active: true, standardType: "INTERNAL" });
      setOpenStandard(false);
      setMessage("Standar berhasil disimpan.");
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  async function saveClause(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        code: String(clauseForm.code || "").trim(),
        title: String(clauseForm.title || "").trim(),
        description: String(clauseForm.description || "").trim() || null,
        active: clauseForm.active !== false,
      };
      await api(
        clauseForm.id
          ? `/master-admin/iso-clauses/${clauseForm.id}`
          : "/master-admin/iso-clauses",
        {
          method: clauseForm.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setClauseForm({ active: true });
      setOpenClause(false);
      setMessage("Klausul ISO berhasil disimpan.");
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  async function deactivate(path: string, label: string) {
    if (!confirm(`Nonaktifkan ${label}?`)) return;
    try {
      await api(path, { method: "DELETE" });
      setMessage(`${label} dinonaktifkan.`);
      await load();
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Standar &amp; ISO</h1>
          <p>
            Kelola sumber kriteria pencapaian standar dan klausul proses ISO
            9001:2015.
          </p>
        </div>
        <div className="actions">
          <button
            onClick={() => {
              setStandardForm({ active: true, standardType: "INTERNAL" });
              setOpenStandard((value) => !value);
            }}
          >
            + Tambah Standar
          </button>
          <button
            className="primary fit"
            onClick={() => {
              setClauseForm({ active: true });
              setOpenClause((value) => !value);
            }}
          >
            + Tambah Klausul ISO
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {(openStandard || openClause) && (
        <div className="planning-grid">
          {openStandard && (
            <form className="panel form-panel" onSubmit={saveStandard}>
              <h2>{standardForm.id ? "Edit Standar" : "Tambah Standar"}</h2>
              <div className="form-row">
                <label>
                  Kode
                  <input
                    required
                    value={standardForm.code || ""}
                    onChange={(event) =>
                      setStandardForm({
                        ...standardForm,
                        code: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Jenis
                  <select
                    value={standardForm.standardType || "INTERNAL"}
                    onChange={(event) =>
                      setStandardForm({
                        ...standardForm,
                        standardType: event.target.value,
                      })
                    }
                  >
                    <option>INTERNAL</option>
                    <option>DIKTI</option>
                    <option>REGULATION</option>
                    <option>ISO</option>
                  </select>
                </label>
              </div>
              <label>
                Judul standar
                <input
                  required
                  value={standardForm.title || ""}
                  onChange={(event) =>
                    setStandardForm({
                      ...standardForm,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Sumber
                <input
                  required
                  value={standardForm.source || ""}
                  onChange={(event) =>
                    setStandardForm({
                      ...standardForm,
                      source: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Referensi regulasi
                <input
                  value={standardForm.regulationReference || ""}
                  onChange={(event) =>
                    setStandardForm({
                      ...standardForm,
                      regulationReference: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Uraian
                <textarea
                  value={standardForm.description || ""}
                  onChange={(event) =>
                    setStandardForm({
                      ...standardForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={standardForm.active !== false}
                  onChange={(event) =>
                    setStandardForm({
                      ...standardForm,
                      active: event.target.checked,
                    })
                  }
                />
                <span>Standar aktif</span>
              </label>
              <div className="actions">
                <button className="primary fit">Simpan Standar</button>
                <button type="button" onClick={() => setOpenStandard(false)}>
                  Batal
                </button>
              </div>
            </form>
          )}
          {openClause && (
            <form className="panel form-panel" onSubmit={saveClause}>
              <h2>
                {clauseForm.id ? "Edit Klausul ISO" : "Tambah Klausul ISO"}
              </h2>
              <label>
                Nomor klausul
                <input
                  required
                  value={clauseForm.code || ""}
                  onChange={(event) =>
                    setClauseForm({ ...clauseForm, code: event.target.value })
                  }
                />
              </label>
              <label>
                Judul/tema
                <input
                  required
                  value={clauseForm.title || ""}
                  onChange={(event) =>
                    setClauseForm({ ...clauseForm, title: event.target.value })
                  }
                />
              </label>
              <label>
                Persyaratan dan fokus audit
                <textarea
                  value={clauseForm.description || ""}
                  onChange={(event) =>
                    setClauseForm({
                      ...clauseForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={clauseForm.active !== false}
                  onChange={(event) =>
                    setClauseForm({
                      ...clauseForm,
                      active: event.target.checked,
                    })
                  }
                />
                <span>Klausul aktif</span>
              </label>
              <div className="actions">
                <button className="primary fit">Simpan Klausul</button>
                <button type="button" onClick={() => setOpenClause(false)}>
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <section className="panel module">
        <div className="toolbar">
          <input
            placeholder="Cari standar atau klausul..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button onClick={load}>Muat ulang</button>
        </div>
      </section>

      <div className="planning-grid">
        <section className="panel">
          <h2>Standar Dikti/Internal</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortableTh
                    label="Kode"
                    column="code"
                    sort={standardSort.sort}
                    onSort={standardSort.toggle}
                  />
                  <SortableTh
                    label="Judul"
                    column="title"
                    sort={standardSort.sort}
                    onSort={standardSort.toggle}
                  />
                  <SortableTh
                    label="Jenis"
                    column="standardType"
                    sort={standardSort.sort}
                    onSort={standardSort.toggle}
                  />
                  <SortableTh
                    label="Status"
                    column="active"
                    sort={standardSort.sort}
                    onSort={standardSort.toggle}
                  />
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {standardSort.sorted.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>
                      <b>{item.title}</b>
                      <br />
                      <small>{item.source}</small>
                    </td>
                    <td>{item.standardType}</td>
                    <td>
                      <span className="badge">
                        {item.active ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="small"
                        onClick={() => {
                          setStandardForm({ ...item });
                          setOpenStandard(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>{" "}
                      {item.active && (
                        <button
                          className="danger small"
                          onClick={() =>
                            deactivate(
                              `/master-admin/standards/${item.id}`,
                              `standar ${item.code}`,
                            )
                          }
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!standardSort.sorted.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Belum ada standar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Klausul ISO 9001:2015</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortableTh
                    label="Klausul"
                    column="code"
                    sort={clauseSort.sort}
                    onSort={clauseSort.toggle}
                  />
                  <SortableTh
                    label="Tema"
                    column="title"
                    sort={clauseSort.sort}
                    onSort={clauseSort.toggle}
                  />
                  <SortableTh
                    label="Status"
                    column="active"
                    sort={clauseSort.sort}
                    onSort={clauseSort.toggle}
                  />
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {clauseSort.sorted.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>
                      <b>{item.title}</b>
                      <br />
                      <small>{item.description || "—"}</small>
                    </td>
                    <td>
                      <span className="badge">
                        {item.active ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="small"
                        onClick={() => {
                          setClauseForm({ ...item });
                          setOpenClause(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>{" "}
                      {item.active && (
                        <button
                          className="danger small"
                          onClick={() =>
                            deactivate(
                              `/master-admin/iso-clauses/${item.id}`,
                              `klausul ${item.code}`,
                            )
                          }
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!clauseSort.sorted.length && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Belum ada klausul ISO.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
