"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export function InstrumentUnitMappingView() {
  const [units, setUnits] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [unitId, setUnitId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [unitRows, questionRows] = await Promise.all([
        api("/master/units"),
        api("/master-admin/questions"),
      ]);
      const activeUnits = (Array.isArray(unitRows) ? unitRows : unitRows?.data || [])
        .filter((item: any) => item.active)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      const activeQuestions = (
        Array.isArray(questionRows) ? questionRows : questionRows?.data || []
      ).filter((item: any) => item.active);
      setUnits(activeUnits);
      setQuestions(activeQuestions);
      setUnitId((current) => current || activeUnits[0]?.id || "");
    } catch (reason: any) {
      setError(reason.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!unitId) {
      setSelected([]);
      return;
    }
    setSelected(
      questions
        .filter((question) =>
          question.unitMaps?.some((mapping: any) => mapping.unitId === unitId),
        )
        .map((question) => String(question.id)),
    );
    setMessage("");
  }, [unitId, questions]);

  const currentUnit = units.find((item) => item.id === unitId);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return questions;
    return questions.filter((question) =>
      [
        question.code,
        question.moduleCode,
        question.question,
        question.standard?.code,
        question.isoClause?.code,
        question.businessProcess,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [questions, query]);

  async function save() {
    if (!unitId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(`/instrument-unit-mapping/units/${unitId}`, {
        method: "PUT",
        body: JSON.stringify({ questionIds: selected }),
      });
      setMessage(
        `${result.mappedQuestionCount} instrumen ditetapkan untuk ${result.unitCode}. ${result.synchronizedEmptyPlans} rencana unit kosong ikut disinkronkan.`,
      );
      await load();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function addFiltered() {
    setSelected((current) => [
      ...new Set([...current, ...filtered.map((question) => String(question.id))]),
    ]);
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Pemetaan Instrumen–Unit</h1>
          <p>
            Tetapkan butir default untuk setiap unit. Pemetaan ini menjadi sumber
            instrumen saat program audit tahunan disusun.
          </p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="panel form-panel">
        <div className="form-row">
          <label>
            Unit target
            <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              <option value="">Pilih unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} — {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cari instrumen
            <input
              placeholder="Kode, pertanyaan, standar, klausul, atau proses"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="mapping-summary">
          <b>{currentUnit ? `${currentUnit.code} — ${currentUnit.name}` : "Belum ada unit dipilih"}</b>
          <span>{selected.length} instrumen dipetakan</span>
          <span>{filtered.length} hasil ditampilkan</span>
          <span>{questions.length} total instrumen aktif</span>
        </div>

        <div className="actions">
          <button type="button" disabled={!filtered.length} onClick={addFiltered}>
            Pilih Hasil Filter ({filtered.length})
          </button>
          <button type="button" disabled={!questions.length} onClick={() => setSelected(questions.map((item) => String(item.id)))}>
            Pilih Semua Aktif
          </button>
          <button type="button" disabled={!selected.length} onClick={() => setSelected([])}>
            Kosongkan
          </button>
        </div>

        <div className="mapping-list">
          {filtered.map((question) => (
            <label className="mapping-row" key={question.id}>
              <input
                type="checkbox"
                checked={selected.includes(String(question.id))}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...new Set([...current, String(question.id)])]
                      : current.filter((id) => id !== String(question.id)),
                  )
                }
              />
              <span>
                <b>{question.code} · {question.moduleCode}</b>
                <small>{question.question}</small>
                <small className="muted">
                  {[question.standard?.code, question.isoClause?.code]
                    .filter(Boolean)
                    .join(" · ") || "Tanpa referensi standar"}
                </small>
              </span>
            </label>
          ))}
          {!filtered.length && (
            <div className="empty">Tidak ada instrumen yang cocok dengan pencarian.</div>
          )}
        </div>

        <div className="actions sticky-actions">
          <button className="primary fit" disabled={busy || !unitId} onClick={save}>
            {busy ? "Menyimpan…" : "Simpan Pemetaan Unit"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .mapping-summary {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          margin: 1rem 0;
          padding: 0.8rem;
          border: 1px solid #dbe4ee;
          border-radius: 10px;
          background: #f8fafc;
        }
        .mapping-summary span {
          padding: 0.25rem 0.55rem;
          border-radius: 999px;
          background: #e8f0fe;
          color: #174ea6;
          font-size: 0.82rem;
        }
        .mapping-list {
          max-height: 520px;
          overflow: auto;
          margin-top: 1rem;
          border: 1px solid #dbe4ee;
          border-radius: 10px;
          background: white;
        }
        .mapping-row {
          display: flex;
          flex-direction: row;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.75rem;
          border-bottom: 1px solid #edf2f7;
        }
        .mapping-row:last-child { border-bottom: 0; }
        .mapping-row input { width: auto; margin-top: 0.25rem; }
        .mapping-row span, .mapping-row small { display: block; }
        .sticky-actions {
          position: sticky;
          bottom: 0;
          padding-top: 1rem;
          background: white;
        }
      `}</style>
    </>
  );
}
