"use client";

import { useEffect, useMemo, useState } from "react";
import { API, api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";

export function InstrumentManagementView({ user }: { user: any }) {
  const canManage = user.roles?.some((role: string) =>
    ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP"].includes(role),
  );
  const [questions, setQuestions] = useState<any[]>([]);
  const [masterUnits, setMasterUnits] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [clauses, setClauses] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    dimension: "PROCESS_CONFORMITY",
    criterionSource: "ISO_9001",
    riskLevel: "MEDIUM",
    weight: 1,
    required: true,
    active: true,
    unitIds: [],
  });
  const [openForm, setOpenForm] = useState(false);
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const [questionRows, unitRows, standardRows, clauseRows] =
        await Promise.all([
          api("/master-admin/questions"),
          api("/master/units"),
          api("/master/standards"),
          api("/master/iso-clauses"),
        ]);
      setQuestions(
        Array.isArray(questionRows) ? questionRows : questionRows?.data || [],
      );
      setMasterUnits(Array.isArray(unitRows) ? unitRows : unitRows?.data || []);
      setStandards(
        Array.isArray(standardRows) ? standardRows : standardRows?.data || [],
      );
      setClauses(
        Array.isArray(clauseRows) ? clauseRows : clauseRows?.data || [],
      );
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const units = useMemo(() => {
    const values = new Map<string, string>();
    questions.forEach((question) =>
      question.unitMaps?.forEach((map: any) =>
        values.set(map.unit.code, map.unit.name),
      ),
    );
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [questions]);

  const shown = useMemo(
    () =>
      questions.filter((question) => {
        const matchesUnit =
          !unit ||
          question.unitMaps?.some((map: any) => map.unit.code === unit);
        const text =
          `${question.code} ${question.moduleCode} ${question.question}`.toLowerCase();
        return matchesUnit && text.includes(query.toLowerCase());
      }),
    [questions, query, unit],
  );
  const questionSort = useSortableRows(shown, "code");

  const grouped = useMemo(() => {
    const result = new Map<string, any[]>();
    questionSort.sorted.forEach((question) => {
      const key = question.moduleCode || "TANPA_MODUL";
      result.set(key, [...(result.get(key) || []), question]);
    });
    return [...result.entries()];
  }, [questionSort.sorted]);

  function resetForm() {
    setForm({
      dimension: "PROCESS_CONFORMITY",
      criterionSource: "ISO_9001",
      riskLevel: "MEDIUM",
      weight: 1,
      required: true,
      active: true,
      unitIds: [],
    });
  }

  function editQuestion(question: any) {
    setForm({
      ...question,
      weight: Number(question.weight),
      standardId: question.standardId || "",
      isoClauseId: question.isoClauseId || "",
      unitIds: question.unitMaps?.map((mapping: any) => mapping.unitId) || [],
    });
    setOpenForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!form.unitIds?.length) {
      setError("Minimal satu unit target wajib dipilih.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        code: String(form.code || "")
          .trim()
          .toUpperCase(),
        moduleCode: String(form.moduleCode || "")
          .trim()
          .toUpperCase(),
        question: String(form.question || "").trim(),
        weight: Number(form.weight || 1),
        standardId: form.standardId || null,
        isoClauseId: form.isoClauseId || null,
      };
      await api(
        form.id
          ? `/master-admin/questions/${form.id}`
          : "/master-admin/questions",
        {
          method: form.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setMessage(`Butir ${payload.code} berhasil disimpan.`);
      resetForm();
      setOpenForm(false);
      await load();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/master/questions/template`, {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Template gagal diunduh.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "template-instrumen-sami-nonak.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Template Excel berhasil diunduh.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(question: any) {
    if (!confirm(`Nonaktifkan butir ${question.code}?`)) return;
    try {
      await api(`/master-admin/questions/${question.id}`, { method: "DELETE" });
      setMessage(`Butir ${question.code} dinonaktifkan.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Instrumen Default</h1>
          <p>
            Bank butir dikelompokkan menurut unit target dan menjadi sumber
            pembentukan instrumen transaksi baru.
          </p>
        </div>
        {canManage && (
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => {
                resetForm();
                setOpenForm((current) => !current);
              }}
            >
              + Tambah Butir
            </button>
            <button disabled={busy} onClick={downloadTemplate}>
              Unduh Template Excel
            </button>
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {canManage && openForm && (
        <form className="panel form-panel" onSubmit={saveQuestion}>
          <h2>{form.id ? "Edit Butir Instrumen" : "Tambah Butir Instrumen"}</h2>
          <div className="form-row">
            <label>
              Kode pertanyaan
              <input
                required
                value={form.code || ""}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
              />
            </label>
            <label>
              Modul
              <input
                required
                value={form.moduleCode || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    moduleCode: event.target.value.toUpperCase(),
                  })
                }
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Dimensi hasil
              <select
                value={form.dimension}
                onChange={(event) =>
                  setForm({ ...form, dimension: event.target.value })
                }
              >
                <option value="STANDARD_ACHIEVEMENT">Pencapaian standar</option>
                <option value="PROCESS_CONFORMITY">
                  Kesesuaian proses ISO
                </option>
              </select>
            </label>
            <label>
              Sumber kriteria
              <input
                required
                value={form.criterionSource || ""}
                onChange={(event) =>
                  setForm({ ...form, criterionSource: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            Pertanyaan audit
            <textarea
              required
              value={form.question || ""}
              onChange={(event) =>
                setForm({ ...form, question: event.target.value })
              }
            />
          </label>
          <label>
            Tujuan audit
            <textarea
              value={form.auditObjective || ""}
              onChange={(event) =>
                setForm({ ...form, auditObjective: event.target.value })
              }
            />
          </label>
          <label>
            Bukti yang diharapkan
            <textarea
              value={form.expectedEvidence || ""}
              onChange={(event) =>
                setForm({ ...form, expectedEvidence: event.target.value })
              }
            />
          </label>
          <label>
            Metode pengujian
            <input
              value={form.testMethod || ""}
              onChange={(event) =>
                setForm({ ...form, testMethod: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label>
              Standar Dikti/Internal
              <select
                value={form.standardId || ""}
                onChange={(event) =>
                  setForm({ ...form, standardId: event.target.value })
                }
              >
                <option value="">Tidak digunakan</option>
                {standards
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} — {item.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Klausul ISO
              <select
                value={form.isoClauseId || ""}
                onChange={(event) =>
                  setForm({ ...form, isoClauseId: event.target.value })
                }
              >
                <option value="">Tidak digunakan</option>
                {clauses
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} — {item.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Tingkat risiko
              <select
                value={form.riskLevel || "MEDIUM"}
                onChange={(event) =>
                  setForm({ ...form, riskLevel: event.target.value })
                }
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>
            <label>
              Bobot
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.weight || 1}
                onChange={(event) =>
                  setForm({ ...form, weight: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            Unit target
            <select
              multiple
              required
              size={Math.min(8, Math.max(3, masterUnits.length))}
              value={form.unitIds || []}
              onChange={(event) =>
                setForm({
                  ...form,
                  unitIds: Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  ),
                })
              }
            >
              {masterUnits
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
            </select>
            <small>Gunakan Ctrl untuk memilih beberapa unit.</small>
          </label>
          <div className="form-row">
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.required !== false}
                onChange={(event) =>
                  setForm({ ...form, required: event.target.checked })
                }
              />
              <span>Wajib dijawab</span>
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(event) =>
                  setForm({ ...form, active: event.target.checked })
                }
              />
              <span>Butir aktif</span>
            </label>
          </div>
          <div className="actions">
            <button className="primary fit" disabled={busy}>
              Simpan Butir
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setOpenForm(false);
              }}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="panel module">
        <div className="toolbar instrument-toolbar">
          <input
            placeholder="Cari kode, modul, atau pertanyaan..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          >
            <option value="">Semua unit target</option>
            {units.map(([code, name]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </select>
          <span className="count">{shown.length} butir</span>
        </div>
        {grouped.length === 0 ? (
          <div className="empty">Belum ada instrumen untuk filter ini.</div>
        ) : (
          grouped.map(([module, rows]) => (
            <section className="instrument-cluster" key={module}>
              <h2>
                {module.replaceAll("_", " ")} <span>{rows.length} butir</span>
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="Kode"
                        column="code"
                        sort={questionSort.sort}
                        onSort={questionSort.toggle}
                      />
                      <SortableTh
                        label="Pertanyaan"
                        column="question"
                        sort={questionSort.sort}
                        onSort={questionSort.toggle}
                      />
                      <SortableTh
                        label="Dimensi"
                        column="dimension"
                        sort={questionSort.sort}
                        onSort={questionSort.toggle}
                      />
                      <th>Unit target</th>
                      <SortableTh
                        label="Risiko"
                        column="riskLevel"
                        sort={questionSort.sort}
                        onSort={questionSort.toggle}
                      />
                      <SortableTh
                        label="Bobot"
                        column="weight"
                        sort={questionSort.sort}
                        onSort={questionSort.toggle}
                      />
                      <SortableTh
                        label="Status"
                        column="active"
                        sort={questionSort.sort}
                        onSort={questionSort.toggle}
                      />
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((question: any) => (
                      <tr key={question.id}>
                        <td>{question.code}</td>
                        <td>
                          <b>{question.question}</b>
                          {question.expectedEvidence && (
                            <small className="question-evidence">
                              Bukti: {question.expectedEvidence}
                            </small>
                          )}
                        </td>
                        <td>
                          <span className="badge">
                            {question.dimension === "STANDARD_ACHIEVEMENT"
                              ? "PENCAPAIAN STANDAR"
                              : "PROSES ISO"}
                          </span>
                        </td>
                        <td>
                          {question.unitMaps
                            ?.map((map: any) => map.unit.code)
                            .join(", ") || "—"}
                        </td>
                        <td>
                          <span className="badge">{question.riskLevel}</span>
                        </td>
                        <td>{Number(question.weight)}</td>
                        <td>
                          <span className="badge">
                            {question.active ? "AKTIF" : "NONAKTIF"}
                          </span>
                        </td>
                        <td>
                          {canManage ? (
                            <>
                              <button
                                className="small"
                                onClick={() => editQuestion(question)}
                              >
                                Edit
                              </button>{" "}
                              {question.active && (
                                <button
                                  className="danger small"
                                  onClick={() => deactivate(question)}
                                >
                                  Nonaktifkan
                                </button>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
