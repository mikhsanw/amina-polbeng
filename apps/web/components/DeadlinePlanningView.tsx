"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const currentYear = new Date().getFullYear();

function dateValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function roles(person: any) {
  return Array.isArray(person.roles)
    ? person.roles.map((item: any) =>
        typeof item === "string" ? item : item.role?.code,
      )
    : [];
}

export function DeadlinePlanningView() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programForm, setProgramForm] = useState<any>({
    auditYear: currentYear,
    status: "PLANNED",
  });
  const [matrix, setMatrix] = useState<any>(null);
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editor, setEditor] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPrograms() {
    const rows = await api("/audit-programs");
    const list = Array.isArray(rows) ? rows : rows?.data || [];
    setPrograms(list);
    if (!selectedProgramId && list.length) setSelectedProgramId(list[0].id);
  }

  async function loadMatrix(programId = selectedProgramId) {
    if (!programId) return setMatrix(null);
    setMatrix(
      await api(`/audit-programs/${programId}/unit-plans/matrix`),
    );
  }

  useEffect(() => {
    loadPrograms().catch((reason: any) => setError(reason.message));
  }, []);

  useEffect(() => {
    loadMatrix().catch((reason: any) => setError(reason.message));
    setEditingPlanId("");
    setEditor(null);
  }, [selectedProgramId]);

  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId,
  );
  const candidates = matrix?.candidates || [];
  const plans = matrix?.plans || [];
  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) =>
      !query
        ? true
        : [question.code, question.question, question.moduleCode]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
    );
  }, [questions, search]);

  async function saveProgram(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await api("/audit-programs", {
        method: "POST",
        body: JSON.stringify(programForm),
      });
      setMessage("Program audit disimpan.");
      await loadPrograms();
      setSelectedProgramId(saved.id);
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function openPlan(plan: any) {
    if (plan.workspace) {
      location.href = `/audit-workspaces/${plan.workspace.id}`;
      return;
    }
    setBusy(true);
    setError("");
    try {
      const instrumentData = await api(
        `/audit-programs/${selectedProgramId}/unit-plans/${plan.id}/instruments`,
      );
      const assignments = plan.assignments || [];
      setEditor({
        included: plan.included !== false,
        leadAuditorId:
          assignments.find((item: any) => item.role === "LEAD_AUDITOR")
            ?.userId || "",
        auditorIds: assignments
          .filter((item: any) => item.role === "AUDITOR")
          .map((item: any) => item.userId),
        verifierId:
          assignments.find((item: any) => item.role === "VERIFIER")?.userId ||
          "",
        questionIds: instrumentData.selectedQuestionIds || [],
        instrumentReviewEnd: dateValue(plan.instrumentReviewEnd),
        instrumentVerificationEnd: dateValue(plan.instrumentVerificationEnd),
      });
      setQuestions(instrumentData.questions || []);
      setEditingPlanId(plan.id);
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(plan: any) {
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api(
        `/audit-programs/${selectedProgramId}/deadline-unit-plans/${plan.id}`,
        { method: "PUT", body: JSON.stringify(editor) },
      );
      setMessage(`Rencana ${plan.unit.name} disimpan: ${saved.status}.`);
      setEditingPlanId("");
      setEditor(null);
      await loadMatrix();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace(plan: any) {
    setBusy(true);
    setError("");
    try {
      const workspace = await api(
        `/audit-programs/${selectedProgramId}/deadline-unit-plans/${plan.id}/workspace`,
        { method: "POST", body: "{}" },
      );
      location.href = `/audit-workspaces/${workspace.id}?tab=instrument`;
    } catch (reason: any) {
      setError(reason.message);
      setBusy(false);
    }
  }

  const leadCandidates = candidates.filter((person: any) =>
    roles(person).includes("KETUA_AUDITOR"),
  );
  const auditorCandidates = candidates.filter((person: any) =>
    roles(person).some((role: string) =>
      ["AUDITOR", "KETUA_AUDITOR"].includes(role),
    ),
  );
  const verifierCandidates = candidates.filter((person: any) =>
    roles(person).includes("VERIFIKATOR"),
  );

  return (
    <div className="deadline-planning">
      <div className="page-title">
        <div>
          <h1>Perencanaan Audit Berbasis Tenggat</h1>
          <p>
            Admin menetapkan batas akhir setiap tahap. Penyelesaian lebih cepat
            langsung membuka tahap berikutnya; keterlambatan memajukan alur dengan
            catatan audit.
          </p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="planning-top-grid">
        <form className="panel form-panel" onSubmit={saveProgram}>
          <h2>Buat Program Audit</h2>
          <div className="form-row">
            <label>
              Tahun audit
              <input
                type="number"
                required
                min="2000"
                max="2100"
                value={programForm.auditYear}
                onChange={(event) =>
                  setProgramForm({
                    ...programForm,
                    auditYear: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Kode
              <input
                required
                placeholder={`AMI-${currentYear}-01`}
                value={programForm.code || ""}
                onChange={(event) =>
                  setProgramForm({ ...programForm, code: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            Nama program
            <input
              required
              value={programForm.name || ""}
              onChange={(event) =>
                setProgramForm({ ...programForm, name: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label>
              Awal program
              <input
                type="date"
                required
                value={programForm.startDate || ""}
                onChange={(event) =>
                  setProgramForm({ ...programForm, startDate: event.target.value })
                }
              />
            </label>
            <label>
              Akhir program
              <input
                type="date"
                required
                value={programForm.endDate || ""}
                onChange={(event) =>
                  setProgramForm({ ...programForm, endDate: event.target.value })
                }
              />
            </label>
          </div>
          <button className="primary fit" disabled={busy}>
            Simpan Program
          </button>
        </form>

        <section className="panel">
          <h2>Pilih Program</h2>
          <select
            value={selectedProgramId}
            onChange={(event) => setSelectedProgramId(event.target.value)}
          >
            <option value="">Pilih program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.code} · {program.name}
              </option>
            ))}
          </select>
          {selectedProgram && (
            <div className="program-summary">
              <b>{selectedProgram.name}</b>
              <span>
                {dateValue(selectedProgram.startDate)} s.d. {dateValue(selectedProgram.endDate)}
              </span>
              <span>{selectedProgram._count?.workspaces || 0} ruang kerja</span>
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Matriks Unit Audit</h2>
            <small>
              Tenggat awal yang wajib: submit telaah dan keputusan Verifikator.
            </small>
          </div>
        </div>
        {!selectedProgramId ? (
          <div className="empty">Pilih program audit.</div>
        ) : !plans.length ? (
          <div className="empty">Memuat unit program…</div>
        ) : (
          <div className="deadline-plan-list">
            {plans.map((plan: any) => (
              <article className="deadline-plan-card" key={plan.id}>
                <header>
                  <div>
                    <b>{plan.unit?.name}</b>
                    <small>
                      {plan.questionCount || plan._count?.questions || 0} instrumen · {plan.status}
                    </small>
                  </div>
                  <div className="actions">
                    {plan.workspace ? (
                      <a className="link-button" href={`/audit-workspaces/${plan.workspace.id}`}>
                        Buka Ruang Kerja
                      </a>
                    ) : (
                      <>
                        <button type="button" onClick={() => openPlan(plan)}>
                          Atur Rencana
                        </button>
                        <button
                          type="button"
                          className="primary"
                          disabled={busy || !plan.ready}
                          onClick={() => createWorkspace(plan)}
                        >
                          Bentuk Ruang Kerja
                        </button>
                      </>
                    )}
                  </div>
                </header>

                {editingPlanId === plan.id && editor && (
                  <div className="deadline-editor">
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={editor.included}
                        onChange={(event) =>
                          setEditor({ ...editor, included: event.target.checked })
                        }
                      />
                      Unit menjadi target audit
                    </label>

                    <div className="editor-columns">
                      <fieldset>
                        <legend>Tim</legend>
                        <label>
                          Ketua Auditor
                          <select
                            value={editor.leadAuditorId}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                leadAuditorId: event.target.value,
                              })
                            }
                          >
                            <option value="">Pilih</option>
                            {leadCandidates
                              .filter((person: any) => person.unitId !== plan.unitId)
                              .map((person: any) => (
                                <option key={person.id} value={person.id}>
                                  {person.fullName}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Verifikator
                          <select
                            value={editor.verifierId}
                            onChange={(event) =>
                              setEditor({ ...editor, verifierId: event.target.value })
                            }
                          >
                            <option value="">Pilih</option>
                            {verifierCandidates
                              .filter((person: any) => person.unitId !== plan.unitId)
                              .map((person: any) => (
                                <option key={person.id} value={person.id}>
                                  {person.fullName}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="auditor-checks">
                          <b>Auditor</b>
                          {auditorCandidates
                            .filter((person: any) => person.unitId !== plan.unitId)
                            .map((person: any) => (
                              <label key={person.id} className="inline-check">
                                <input
                                  type="checkbox"
                                  checked={editor.auditorIds.includes(person.id)}
                                  onChange={(event) =>
                                    setEditor({
                                      ...editor,
                                      auditorIds: event.target.checked
                                        ? [...editor.auditorIds, person.id]
                                        : editor.auditorIds.filter(
                                            (id: string) => id !== person.id,
                                          ),
                                    })
                                  }
                                />
                                {person.fullName}
                              </label>
                            ))}
                        </div>
                      </fieldset>

                      <fieldset>
                        <legend>Tenggat Awal</legend>
                        <label>
                          Paling lambat submit telaah
                          <input
                            type="date"
                            value={editor.instrumentReviewEnd}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                instrumentReviewEnd: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Paling lambat keputusan Verifikator
                          <input
                            type="date"
                            value={editor.instrumentVerificationEnd}
                            onChange={(event) =>
                              setEditor({
                                ...editor,
                                instrumentVerificationEnd: event.target.value,
                              })
                            }
                          />
                        </label>
                        <p className="muted">
                          Tenggat Auditee dan review Auditor ditetapkan saat Admin Mutu mempublikasikan instrumen.
                        </p>
                      </fieldset>
                    </div>

                    <fieldset>
                      <legend>Instrumen Unit</legend>
                      <input
                        placeholder="Cari instrumen…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      <div className="instrument-list">
                        {filteredQuestions.map((question: any) => (
                          <label key={question.id} className="instrument-choice">
                            <input
                              type="checkbox"
                              checked={editor.questionIds.includes(question.id)}
                              onChange={(event) =>
                                setEditor({
                                  ...editor,
                                  questionIds: event.target.checked
                                    ? [...editor.questionIds, question.id]
                                    : editor.questionIds.filter(
                                        (id: string) => id !== question.id,
                                      ),
                                })
                              }
                            />
                            <span>
                              <b>{question.code}</b>
                              <small>{question.question}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={busy}
                        onClick={() => savePlan(plan)}
                      >
                        Simpan Rencana Unit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlanId("");
                          setEditor(null);
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .planning-top-grid, .editor-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; }
        .program-summary { display:grid; gap:.4rem; margin-top:1rem; padding:1rem; background:#f8fafc; border-radius:10px; }
        .deadline-plan-list { display:grid; gap:.85rem; }
        .deadline-plan-card { border:1px solid #dbe4ee; border-radius:12px; overflow:hidden; }
        .deadline-plan-card > header { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:1rem; background:#f8fafc; }
        .deadline-plan-card header div:first-child { display:grid; gap:.25rem; }
        .deadline-editor { padding:1rem; display:grid; gap:1rem; }
        fieldset { min-width:0; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; }
        legend { font-weight:700; padding:0 .4rem; }
        .inline-check { display:flex; flex-direction:row; align-items:center; gap:.5rem; }
        .inline-check input, .instrument-choice input { width:auto; }
        .auditor-checks { display:grid; gap:.45rem; margin-top:.75rem; max-height:190px; overflow:auto; }
        .instrument-list { max-height:360px; overflow:auto; border:1px solid #dbe4ee; border-radius:8px; margin-top:.7rem; }
        .instrument-choice { display:flex; flex-direction:row; gap:.65rem; padding:.65rem; border-bottom:1px solid #edf2f7; }
        .instrument-choice span, .instrument-choice small { display:block; }
        .actions { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
        @media(max-width:900px){ .planning-top-grid,.editor-columns{grid-template-columns:1fr;} .deadline-plan-card > header{align-items:flex-start;flex-direction:column;} }
      `}</style>
    </div>
  );
}
