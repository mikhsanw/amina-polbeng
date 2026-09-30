"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";
import {
  AnnualUnitPlanEditor,
  PlanEditorState,
} from "./AnnualUnitPlanEditor";

const currentYear = new Date().getFullYear();
const auditYearLookahead = 2;

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dateLabel(value: unknown) {
  if (!value) return "Belum ditetapkan";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Belum ditetapkan"
    : date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function statusLabel(value: unknown) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PLANNED: "Ditetapkan",
    READY: "Siap Dibentuk",
    EXCLUDED: "Tidak Diaudit",
    WORKSPACE_CREATED: "Ruang Kerja Dibentuk",
    INSTRUMENT_REVIEW: "Telaah Instrumen",
    INSTRUMENT_APPROVAL: "Verifikasi Instrumen",
    SELF_ASSESSMENT: "Self-Assessment",
    DESK_REVIEW: "Review Auditor",
    AUDIT: "Keputusan Admin Mutu",
    FIELD_AUDIT: "Assessment Lapangan",
    REPORTING: "Penyusunan Laporan",
    FOLLOW_UP: "CAPA/Tindak Lanjut",
    REPORT_REVIEW: "Review Laporan Akhir",
    CLOSED: "Selesai",
  };
  const text = String(value || "DRAFT");
  return labels[text] || text.replaceAll("_", " ");
}

function editorFromPlan(plan: any): PlanEditorState {
  const assignments = plan.assignments || [];
  return {
    included: plan.included !== false,
    leadAuditorId:
      assignments.find((item: any) => item.role === "LEAD_AUDITOR")?.userId ||
      "",
    auditorIds: assignments
      .filter((item: any) => item.role === "AUDITOR")
      .map((item: any) => String(item.userId)),
    verifierId:
      assignments.find((item: any) => item.role === "VERIFIER")?.userId || "",
    questionIds: [],
    instrumentReviewEnd: dateInput(plan.instrumentReviewEnd),
    instrumentVerificationEnd: dateInput(plan.instrumentVerificationEnd),
  };
}

export function PlanningView() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [form, setForm] = useState<any>({ status: "DRAFT" });
  const [matrix, setMatrix] = useState<any>(null);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editor, setEditor] = useState<PlanEditorState | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [busyUnitId, setBusyUnitId] = useState("");
  const [busyProgramId, setBusyProgramId] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function loadBase() {
    setError("");
    try {
      const [programData, unitData] = await Promise.all([
        api("/audit-programs"),
        api("/master/units"),
      ]);
      setPrograms(
        Array.isArray(programData) ? programData : programData?.data || [],
      );
      const unitRows = Array.isArray(unitData) ? unitData : unitData?.data || [];
      setUnits(unitRows.filter((unit: any) => unit.active));
    } catch (reason: any) {
      setError(reason.message || "Data perencanaan gagal dimuat.");
    }
  }

  async function loadMatrix(programId = selectedProgramId) {
    if (!programId) {
      setMatrix(null);
      return;
    }
    setMatrixBusy(true);
    setError("");
    try {
      setMatrix(
        await api(`/audit-programs/${programId}/unit-plans/matrix`),
      );
    } catch (reason: any) {
      setError(reason.message || "Matriks unit gagal dimuat.");
      setMatrix(null);
    } finally {
      setMatrixBusy(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  const yearPrograms = useMemo(
    () =>
      programs.filter(
        (program) => Number(program.auditYear) === Number(selectedYear),
      ),
    [programs, selectedYear],
  );

  useEffect(() => {
    if (!yearPrograms.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(yearPrograms[0]?.id || "");
    }
  }, [yearPrograms, selectedProgramId]);

  useEffect(() => {
    setEditingPlanId("");
    setEditor(null);
    loadMatrix(selectedProgramId);
  }, [selectedProgramId]);

  const yearOptions = useMemo(() => {
    const automaticYears = Array.from(
      { length: auditYearLookahead + 1 },
      (_, index) => currentYear + index,
    );
    return [
      ...new Set([
        ...automaticYears,
        ...programs.map((program) => Number(program.auditYear)),
      ]),
    ]
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
  }, [programs]);

  const programSort = useSortableRows(yearPrograms, "code");
  const plans = matrix?.plans || [];
  const candidates = matrix?.candidates || [];
  const selectedProgram = yearPrograms.find(
    (program) => program.id === selectedProgramId,
  );
  const readyCount = plans.filter((plan: any) => plan.ready).length;
  const workspaceCount = plans.filter((plan: any) => plan.workspace).length;
  const includedCount = plans.filter((plan: any) => plan.included !== false).length;

  const matrixRows = selectedProgramId
    ? plans
    : units.map((unit) => ({
        id: `placeholder-${unit.id}`,
        unitId: unit.id,
        unit,
        included: true,
        status: "BELUM ADA PROGRAM",
        assignments: [],
        questionCount: 0,
        _count: { questions: 0 },
      }));

  function resetProgramForm() {
    setForm({ status: "DRAFT" });
  }

  async function saveProgram(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setOk("");
    setBusyProgramId(form.id || "new");
    const payload = { ...form, auditYear: selectedYear };
    try {
      const saved = form.id
        ? await api(`/audit-programs/${form.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await api("/audit-programs", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      resetProgramForm();
      setOk(
        form.id
          ? `Program ${saved.code} berhasil diperbarui.`
          : `Program ${saved.code} berhasil dibuat.`,
      );
      await loadBase();
      setSelectedProgramId(saved.id);
    } catch (reason: any) {
      setError(reason.message || "Program audit gagal disimpan.");
    } finally {
      setBusyProgramId("");
    }
  }

  async function removeProgram(program: any) {
    const transactionCount = program._count?.workspaces || 0;
    let path = `/audit-programs/${program.id}`;
    let body: string | undefined;

    if (transactionCount) {
      const confirmation = prompt(
        `Program ${program.code} memiliki ${transactionCount} ruang kerja. Ketik ${program.code} untuk menghapus program beserta seluruh transaksi:`,
      );
      if (confirmation == null) return;
      if (confirmation.trim() !== program.code) {
        setError(`Konfirmasi tidak cocok. Ketik tepat: ${program.code}`);
        return;
      }
      path += "?cascade=true";
      body = JSON.stringify({ confirmation: program.code });
    } else if (!confirm(`Hapus program ${program.code}?`)) {
      return;
    }

    setBusyProgramId(program.id);
    setError("");
    setOk("");
    try {
      await api(path, { method: "DELETE", body });
      if (selectedProgramId === program.id) setSelectedProgramId("");
      if (form.id === program.id) resetProgramForm();
      setOk(`Program ${program.code} berhasil dihapus.`);
      await loadBase();
    } catch (reason: any) {
      setError(reason.message || "Program gagal dihapus.");
    } finally {
      setBusyProgramId("");
    }
  }

  function editProgram(program: any) {
    setSelectedProgramId(program.id);
    setForm({
      ...program,
      startDate: dateInput(program.startDate),
      endDate: dateInput(program.endDate),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openEditor(plan: any) {
    if (!selectedProgramId || plan.workspace) return;
    setBusyUnitId(plan.id);
    setError("");
    try {
      const data = await api(
        `/audit-programs/${selectedProgramId}/unit-plans/${plan.id}/instruments`,
      );
      const next = editorFromPlan(plan);
      next.questionIds = (data.selectedQuestionIds || []).map(String);
      setAvailableQuestions(data.questions || []);
      setEditor(next);
      setEditingPlanId(plan.id);
    } catch (reason: any) {
      setError(reason.message || "Rencana unit gagal dibuka.");
    } finally {
      setBusyUnitId("");
    }
  }

  async function saveUnitPlan(plan: any) {
    if (!editor || !selectedProgramId) return;
    setBusyUnitId(plan.id);
    setError("");
    setOk("");
    try {
      const result = await api(
        `/audit-programs/${selectedProgramId}/deadline-unit-plans/${plan.id}`,
        { method: "PUT", body: JSON.stringify(editor) },
      );
      setOk(
        `Rencana ${plan.unit.name} berhasil disimpan. Status: ${statusLabel(result.status)}.`,
      );
      setEditingPlanId("");
      setEditor(null);
      await loadMatrix();
    } catch (reason: any) {
      setError(reason.message || "Rencana unit gagal disimpan.");
    } finally {
      setBusyUnitId("");
    }
  }

  async function createWorkspace(plan: any) {
    if (!selectedProgramId) return;
    setBusyUnitId(plan.id);
    setError("");
    try {
      const workspace = await api(
        `/audit-programs/${selectedProgramId}/deadline-unit-plans/${plan.id}/workspace`,
        { method: "POST", body: "{}" },
      );
      location.href = `/audit-workspaces/${workspace.id}?tab=instrument`;
    } catch (reason: any) {
      setError(reason.message || "Ruang kerja gagal dibentuk.");
      setBusyUnitId("");
    }
  }

  return (
    <>
      <div className="page-title planning-title">
        <div>
          <span className="page-eyebrow">PERENCANAAN AMI NONAKADEMIK</span>
          <h1>Perencanaan Audit Tahunan</h1>
          <p>
            Tetapkan program, unit target, instrumen, tim audit, dan batas akhir
            tahapan awal dalam satu matriks yang terukur.
          </p>
        </div>
        <div className="title-year">
          <small>TAHUN AKTIF</small>
          <b>{selectedYear}</b>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {ok && <div className="success">{ok}</div>}

      <section className="year-selector panel">
        <div className="step-number">1</div>
        <div className="year-copy">
          <h2>Pilih Tahun Audit</h2>
          <p>
            Tahun baru tersedia otomatis sampai {currentYear + auditYearLookahead}.
            Tahun lama tetap tampil bila sudah memiliki program.
          </p>
        </div>
        <select
          aria-label="Tahun audit"
          value={selectedYear}
          onChange={(event) => {
            setSelectedYear(Number(event.target.value));
            resetProgramForm();
          }}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              Tahun Audit {year}
            </option>
          ))}
        </select>
      </section>

      <div className="planning-summary-grid">
        <div className="summary-card">
          <small>PROGRAM TAHUN INI</small>
          <b>{yearPrograms.length}</b>
          <span>program audit</span>
        </div>
        <div className="summary-card">
          <small>UNIT TARGET</small>
          <b>{selectedProgramId ? includedCount : units.length}</b>
          <span>unit aktif</span>
        </div>
        <div className="summary-card">
          <small>SIAP DIBENTUK</small>
          <b>{readyCount}</b>
          <span>rencana lengkap</span>
        </div>
        <div className="summary-card">
          <small>RUANG KERJA</small>
          <b>{workspaceCount}</b>
          <span>sudah dibentuk</span>
        </div>
      </div>

      <div className="planning-grid">
        <form className="panel form-panel program-form" onSubmit={saveProgram}>
          <div className="step-heading">
            <span className="step-number">2</span>
            <div>
              <h2>{form.id ? "Edit Program" : "Buat Program Audit"}</h2>
              <p>
                Seluruh unit aktif otomatis masuk ke matriks setelah program
                disimpan.
              </p>
            </div>
          </div>

          <div className="program-code-row">
            <label>
              Kode program
              <input
                required
                placeholder={`AMI-${selectedYear}-01`}
                value={form.code || ""}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
              />
            </label>
            <label>
              Status
              <select
                value={form.status || "DRAFT"}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="PLANNED">Ditetapkan</option>
              </select>
            </label>
          </div>

          <label>
            Nama kegiatan
            <input
              required
              placeholder={`Audit Mutu Internal Nonakademik ${selectedYear}`}
              value={form.name || ""}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>

          <div className="form-row">
            <label>
              Mulai program
              <input
                type="date"
                required
                value={form.startDate || ""}
                onChange={(event) =>
                  setForm({ ...form, startDate: event.target.value })
                }
              />
            </label>
            <label>
              Selesai program
              <input
                type="date"
                required
                min={form.startDate || undefined}
                value={form.endDate || ""}
                onChange={(event) =>
                  setForm({ ...form, endDate: event.target.value })
                }
              />
            </label>
          </div>

          <div className="actions program-form-actions">
            <button
              className="primary fit"
              disabled={Boolean(busyProgramId)}
            >
              {busyProgramId
                ? "Menyimpan…"
                : form.id
                  ? "Simpan Perubahan"
                  : "Simpan Program"}
            </button>
            {form.id && (
              <button type="button" onClick={resetProgramForm}>
                Batal Edit
              </button>
            )}
          </div>
        </form>

        <section className="panel program-list-panel">
          <div className="section-header">
            <div>
              <h2>Program Tahun {selectedYear}</h2>
              <small>Pilih program untuk menampilkan matriks unit.</small>
            </div>
            <span className="count-pill">{yearPrograms.length} program</span>
          </div>

          <div className="table-wrap">
            <table className="table program-table">
              <thead>
                <tr>
                  <SortableTh
                    label="Kode"
                    column="code"
                    sort={programSort.sort}
                    onSort={programSort.toggle}
                  />
                  <SortableTh
                    label="Nama Program"
                    column="name"
                    sort={programSort.sort}
                    onSort={programSort.toggle}
                  />
                  <SortableTh
                    label="Periode"
                    column="startDate"
                    sort={programSort.sort}
                    onSort={programSort.toggle}
                  />
                  <th>Status</th>
                  <th>Ruang Kerja</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {programSort.sorted.map((program) => (
                  <tr
                    key={program.id}
                    className={
                      selectedProgramId === program.id ? "selected-row" : ""
                    }
                  >
                    <td>
                      <b>{program.code}</b>
                    </td>
                    <td>{program.name}</td>
                    <td>
                      <span className="period-cell">
                        {dateLabel(program.startDate)}
                        <small>s.d. {dateLabel(program.endDate)}</small>
                      </span>
                    </td>
                    <td>
                      <span className="badge">{statusLabel(program.status)}</span>
                    </td>
                    <td>{program._count?.workspaces || 0}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="small"
                          onClick={() => setSelectedProgramId(program.id)}
                        >
                          Pilih
                        </button>
                        <button
                          type="button"
                          className="small"
                          onClick={() => editProgram(program)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger small"
                          disabled={busyProgramId === program.id}
                          onClick={() => removeProgram(program)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!yearPrograms.length && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-table-state">
                        <b>Belum ada program audit tahun {selectedYear}</b>
                        <span>
                          Isi formulir di sebelah kiri untuk membuat program.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel annual-matrix">
        <div className="step-heading matrix-heading">
          <span className="step-number">3</span>
          <div>
            <h2>Matriks Perencanaan Seluruh Unit</h2>
            <p>
              Atur instrumen, tim, batas submit telaah, dan batas keputusan
              Verifikator untuk setiap unit.
            </p>
          </div>
          <label className="matrix-program-select">
            Program yang digunakan
            <select
              value={selectedProgramId}
              onChange={(event) => setSelectedProgramId(event.target.value)}
            >
              <option value="">Pilih program tahun {selectedYear}</option>
              {yearPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} — {program.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedProgram && (
          <div className="selected-program-banner">
            <div>
              <small>PROGRAM TERPILIH</small>
              <b>{selectedProgram.code} · {selectedProgram.name}</b>
            </div>
            <span>
              {dateLabel(selectedProgram.startDate)} s.d. {dateLabel(selectedProgram.endDate)}
            </span>
          </div>
        )}

        {matrixBusy && (
          <div className="matrix-loading">Memuat matriks unit…</div>
        )}

        <div className="table-wrap">
          <table className="table planning-matrix-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Unit Target</th>
                <th>Instrumen</th>
                <th>Ketua Auditor</th>
                <th>Auditor</th>
                <th>Verifikator</th>
                <th>Batas Telaah</th>
                <th>Batas Verifikasi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((plan: any) => {
                const lead = plan.assignments?.find(
                  (item: any) => item.role === "LEAD_AUDITOR",
                );
                const auditors = plan.assignments?.filter(
                  (item: any) => item.role === "AUDITOR",
                );
                const verifier = plan.assignments?.find(
                  (item: any) => item.role === "VERIFIER",
                );
                const displayStatus =
                  plan.workspace?.status ||
                  (plan.ready ? "READY" : plan.status || "DRAFT");

                return (
                  <Fragment key={plan.id}>
                    <tr
                      className={
                        plan.included === false ? "row-muted" : undefined
                      }
                    >
                      <td>
                        <b>{plan.unit?.code || "—"}</b>
                      </td>
                      <td>
                        <span className="unit-cell">
                          <b>{plan.unit?.name || "Unit tidak ditemukan"}</b>
                          {plan.included === false && (
                            <small>Tidak menjadi target audit</small>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="instrument-count-cell">
                          <b>{plan.questionCount || plan._count?.questions || 0}</b>
                          <small>
                            Default unit: {plan.defaultInstrumentCount || 0}
                          </small>
                        </span>
                      </td>
                      <td>{lead?.user?.fullName || "Belum dipilih"}</td>
                      <td>
                        {auditors?.length ? (
                          <div className="person-list">
                            {auditors.map((item: any) => (
                              <span key={item.id}>
                                {item.user?.fullName || "Pengguna tidak aktif"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "Belum dipilih"
                        )}
                      </td>
                      <td>{verifier?.user?.fullName || "Belum dipilih"}</td>
                      <td>
                        <span className="deadline-cell">
                          {dateLabel(plan.instrumentReviewEnd)}
                        </span>
                      </td>
                      <td>
                        <span className="deadline-cell">
                          {dateLabel(plan.instrumentVerificationEnd)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            plan.ready || plan.workspace ? "" : "warning"
                          }`}
                        >
                          {statusLabel(displayStatus)}
                        </span>
                      </td>
                      <td>
                        <div className="matrix-actions">
                          {plan.workspace ? (
                            <button
                              type="button"
                              className="primary fit"
                              onClick={() =>
                                (location.href = `/audit-workspaces/${plan.workspace.id}`)
                              }
                            >
                              Buka Audit
                            </button>
                          ) : selectedProgramId ? (
                            <>
                              <button
                                type="button"
                                className="small"
                                disabled={busyUnitId === plan.id}
                                onClick={() =>
                                  editingPlanId === plan.id
                                    ? (setEditingPlanId(""), setEditor(null))
                                    : openEditor(plan)
                                }
                              >
                                {editingPlanId === plan.id
                                  ? "Tutup Editor"
                                  : "Edit Rencana"}
                              </button>
                              <button
                                type="button"
                                className="primary fit"
                                disabled={!plan.ready || busyUnitId === plan.id}
                                onClick={() => createWorkspace(plan)}
                              >
                                Bentuk Ruang Kerja
                              </button>
                            </>
                          ) : (
                            <span className="muted">Buat atau pilih program</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingPlanId === plan.id && editor && (
                      <tr className="editor-row">
                        <td colSpan={10}>
                          <AnnualUnitPlanEditor
                            plan={plan}
                            candidates={candidates}
                            editor={editor}
                            setEditor={setEditor}
                            questions={availableQuestions}
                            busy={busyUnitId === plan.id}
                            onSave={() => saveUnitPlan(plan)}
                            onCancel={() => {
                              setEditingPlanId("");
                              setEditor(null);
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!matrixRows.length && !matrixBusy && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-table-state">
                      <b>Belum ada unit aktif.</b>
                      <span>Tambahkan unit pada menu Master Unit.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .planning-title {
          align-items: center;
        }
        .page-eyebrow {
          display: block;
          margin-bottom: 0.35rem;
          color: #2563eb;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.09em;
        }
        .title-year {
          display: grid;
          min-width: 118px;
          gap: 0.1rem;
          padding: 0.75rem 1rem;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
          text-align: right;
        }
        .title-year small {
          color: #64748b;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .title-year b {
          color: #1d4ed8;
          font-size: 1.45rem;
        }
        .year-selector {
          display: grid;
          grid-template-columns: auto 1fr minmax(210px, 280px);
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
          padding: 1rem 1.1rem;
          background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
          border-color: #bfdbfe;
        }
        .year-copy h2,
        .year-copy p {
          margin: 0;
        }
        .year-copy p {
          margin-top: 0.2rem;
          color: #64748b;
        }
        .step-number {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: #2563eb;
          color: #fff;
          font-weight: 800;
        }
        .planning-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .summary-card {
          display: grid;
          gap: 0.15rem;
          padding: 0.85rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }
        .summary-card small {
          color: #64748b;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.07em;
        }
        .summary-card b {
          color: #0f172a;
          font-size: 1.45rem;
        }
        .summary-card span {
          color: #64748b;
          font-size: 0.82rem;
        }
        .planning-grid {
          display: grid;
          grid-template-columns: minmax(340px, 0.78fr) minmax(0, 1.42fr);
          gap: 1rem;
          align-items: start;
          margin-bottom: 1rem;
        }
        .program-form,
        .program-list-panel {
          min-height: 100%;
        }
        .step-heading {
          display: flex;
          gap: 0.8rem;
          align-items: flex-start;
        }
        .step-heading h2,
        .step-heading p {
          margin: 0;
        }
        .step-heading p {
          margin-top: 0.2rem;
          color: #64748b;
        }
        .program-code-row {
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 0.75rem;
        }
        .program-form-actions {
          margin-top: 0.25rem;
        }
        .section-header,
        .matrix-heading,
        .selected-program-banner {
          display: flex;
          gap: 1rem;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .count-pill {
          padding: 0.3rem 0.55rem;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .program-table {
          min-width: 780px;
        }
        .selected-row td {
          background: #eff6ff;
        }
        .period-cell,
        .unit-cell,
        .instrument-count-cell {
          display: grid;
          gap: 0.15rem;
        }
        .period-cell small,
        .unit-cell small,
        .instrument-count-cell small {
          color: #64748b;
        }
        .row-actions,
        .matrix-actions,
        .person-list {
          display: flex;
          gap: 0.35rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .person-list {
          display: grid;
          align-items: initial;
        }
        .person-list span {
          padding: 0.15rem 0.4rem;
          border-radius: 6px;
          background: #f1f5f9;
          font-size: 0.8rem;
        }
        .annual-matrix {
          padding: 0;
          overflow: hidden;
        }
        .matrix-heading {
          padding: 1rem 1.1rem;
          border-bottom: 1px solid #e2e8f0;
          background: #fff;
        }
        .matrix-heading > div:nth-child(2) {
          flex: 1 1 420px;
        }
        .matrix-program-select {
          min-width: min(100%, 360px);
        }
        .selected-program-banner {
          margin: 0.85rem 1rem 0;
          padding: 0.75rem 0.9rem;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          background: #eff6ff;
        }
        .selected-program-banner div {
          display: grid;
          gap: 0.15rem;
        }
        .selected-program-banner small {
          color: #2563eb;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.07em;
        }
        .selected-program-banner > span {
          color: #475569;
        }
        .matrix-loading {
          margin: 0.85rem 1rem;
          padding: 0.75rem;
          border-radius: 9px;
          background: #f8fafc;
          color: #475569;
        }
        .planning-matrix-table {
          min-width: 1660px;
          margin-top: 0.85rem;
        }
        .planning-matrix-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          white-space: nowrap;
        }
        .deadline-cell {
          display: inline-block;
          min-width: 105px;
          color: #334155;
          font-size: 0.82rem;
        }
        .row-muted {
          opacity: 0.58;
        }
        .editor-row > td {
          padding: 0.75rem !important;
          background: #f8fafc;
        }
        .empty-table-state {
          display: grid;
          place-items: center;
          gap: 0.25rem;
          min-height: 120px;
          color: #64748b;
          text-align: center;
        }
        .empty-table-state b {
          color: #334155;
        }
        @media (max-width: 1100px) {
          .planning-grid {
            grid-template-columns: 1fr;
          }
          .planning-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .year-selector {
            grid-template-columns: auto 1fr;
          }
          .year-selector select {
            grid-column: 1 / -1;
          }
          .planning-summary-grid,
          .program-code-row {
            grid-template-columns: 1fr;
          }
          .title-year {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
