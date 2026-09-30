"use client";

import { useMemo, useState } from "react";

export type PlanEditorState = {
  included: boolean;
  leadAuditorId: string;
  auditorIds: string[];
  verifierId: string;
  questionIds: string[];
  instrumentReviewEnd: string;
  instrumentVerificationEnd: string;
};

type InstrumentView = "ALL" | "DEFAULT" | "SELECTED";

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    KETUA_AUDITOR: "Ketua Auditor",
    AUDITOR: "Auditor",
    VERIFIKATOR: "Verifikator",
  };
  return labels[role] || role.replaceAll("_", " ");
}

function instrumentSearchText(question: any) {
  return [
    question.code,
    question.question,
    question.moduleCode,
    question.standard?.code,
    question.standard?.title,
    question.isoClause?.code,
    question.isoClause?.title,
    question.businessProcess,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function AnnualUnitPlanEditor({
  plan,
  candidates,
  editor,
  setEditor,
  questions,
  busy,
  onSave,
  onCancel,
}: {
  plan: any;
  candidates: any[];
  editor: PlanEditorState;
  setEditor: (value: PlanEditorState) => void;
  questions: any[];
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<InstrumentView>("ALL");
  const [notice, setNotice] = useState("");

  const eligible = (allowedRoles: string[]) =>
    candidates.filter(
      (person) =>
        person.unitId !== plan.unitId &&
        allowedRoles.some((role) => (person.roles || []).includes(role)),
    );

  const leadCandidates = eligible(["KETUA_AUDITOR"]);
  const auditorCandidates = eligible(["AUDITOR", "KETUA_AUDITOR"]);
  const verifierCandidates = eligible(["VERIFIKATOR"]);

  const defaultQuestionIds = useMemo(
    () =>
      questions
        .filter((question) => question.mappedToUnit)
        .map((question) => String(question.id)),
    [questions],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      const id = String(question.id);
      if (view === "DEFAULT" && !question.mappedToUnit) return false;
      if (view === "SELECTED" && !editor.questionIds.includes(id)) return false;
      return !query || instrumentSearchText(question).includes(query);
    });
  }, [questions, search, view, editor.questionIds]);

  function selectDefaults() {
    setEditor({ ...editor, questionIds: defaultQuestionIds });
    setView("DEFAULT");
    setNotice(
      `${defaultQuestionIds.length} instrumen default unit dipilih. Simpan rencana agar perubahan diterapkan.`,
    );
  }

  function selectFiltered() {
    const selected = [
      ...new Set([
        ...editor.questionIds,
        ...filtered.map((question) => String(question.id)),
      ]),
    ];
    setEditor({ ...editor, questionIds: selected });
    setNotice(
      `${filtered.length} hasil filter ditambahkan. Total pilihan: ${selected.length} instrumen.`,
    );
  }

  const teamComplete =
    Boolean(editor.leadAuditorId) &&
    editor.auditorIds.length > 0 &&
    Boolean(editor.verifierId);
  const deadlinesComplete =
    Boolean(editor.instrumentReviewEnd) &&
    Boolean(editor.instrumentVerificationEnd);

  return (
    <div className="unit-plan-editor">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">RENCANA UNIT</span>
          <h3>{plan.unit.name}</h3>
          <p>
            Tetapkan tim, tenggat awal, dan instrumen sebelum ruang kerja audit
            dibentuk.
          </p>
        </div>
        <label className="target-switch">
          <input
            type="checkbox"
            checked={editor.included}
            onChange={(event) =>
              setEditor({ ...editor, included: event.target.checked })
            }
          />
          <span>
            <b>Unit menjadi target audit</b>
            <small>Matikan bila unit tidak diaudit pada program ini.</small>
          </span>
        </label>
      </div>

      <div className="editor-status-grid">
        <div className={teamComplete ? "complete" : "incomplete"}>
          <small>TIM</small>
          <b>{teamComplete ? "Lengkap" : "Belum lengkap"}</b>
        </div>
        <div className={deadlinesComplete ? "complete" : "incomplete"}>
          <small>TENGGAT AWAL</small>
          <b>{deadlinesComplete ? "Lengkap" : "Belum lengkap"}</b>
        </div>
        <div className={editor.questionIds.length ? "complete" : "incomplete"}>
          <small>INSTRUMEN</small>
          <b>{editor.questionIds.length} dipilih</b>
        </div>
      </div>

      <div className="editor-grid">
        <fieldset>
          <legend>Tim Audit</legend>
          <div className="two-columns">
            <label>
              Ketua Auditor
              <select
                value={editor.leadAuditorId}
                onChange={(event) =>
                  setEditor({ ...editor, leadAuditorId: event.target.value })
                }
              >
                <option value="">Pilih Ketua Auditor</option>
                {leadCandidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                    {person.unit?.name ? ` · ${person.unit.name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Verifikator Instrumen
              <select
                value={editor.verifierId}
                onChange={(event) =>
                  setEditor({ ...editor, verifierId: event.target.value })
                }
              >
                <option value="">Pilih Verifikator</option>
                {verifierCandidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                    {person.unit?.name ? ` · ${person.unit.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-heading">
            <div>
              <b>Auditor</b>
              <small>Pilih minimal satu Auditor di luar unit Auditee.</small>
            </div>
            <span>{editor.auditorIds.length} dipilih</span>
          </div>
          <div className="choice-list compact-choice-list">
            {auditorCandidates.map((person) => {
              const personId = String(person.id);
              return (
                <label key={person.id} className="choice-row">
                  <input
                    type="checkbox"
                    checked={editor.auditorIds.includes(personId)}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        auditorIds: event.target.checked
                          ? [...new Set([...editor.auditorIds, personId])]
                          : editor.auditorIds.filter((id) => id !== personId),
                      })
                    }
                  />
                  <span>
                    <b>{person.fullName}</b>
                    <small>
                      {(person.roles || []).map(roleLabel).join(", ")}
                      {person.unit?.name ? ` · ${person.unit.name}` : ""}
                    </small>
                  </span>
                </label>
              );
            })}
            {!auditorCandidates.length && (
              <div className="empty-state">
                Belum ada pengguna aktif dengan role Auditor atau Ketua Auditor
                di luar unit Auditee.
              </div>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Tenggat Awal</legend>
          <div className="deadline-intro">
            <b>Hanya batas akhir yang ditetapkan.</b>
            <p>
              Penyelesaian lebih cepat langsung membuka tahap berikutnya. Saat
              tenggat berakhir, sistem memajukan alur dan mencatat keterlambatan.
            </p>
          </div>
          <div className="deadline-stack">
            <label>
              <span>1</span>
              <div>
                <b>Paling lambat submit telaah instrumen</b>
                <small>Ketua Auditor mengirim hasil telaah kepada Verifikator.</small>
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
              </div>
            </label>
            <label>
              <span>2</span>
              <div>
                <b>Paling lambat keputusan Verifikator</b>
                <small>Hasil validasi dikirim kepada Admin Mutu.</small>
                <input
                  type="date"
                  min={editor.instrumentReviewEnd || undefined}
                  value={editor.instrumentVerificationEnd}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      instrumentVerificationEnd: event.target.value,
                    })
                  }
                />
              </div>
            </label>
          </div>
          <div className="info-box">
            Tenggat unggah Auditee dan review Auditor ditetapkan saat Admin Mutu
            mempublikasikan instrumen. Tenggat lapangan, laporan, dan CAPA
            ditetapkan setelah review Auditor disetujui.
          </div>
        </fieldset>
      </div>

      <fieldset className="instrument-fieldset">
        <legend>Instrumen Audit Unit</legend>

        {!questions.length ? (
          <div className="empty-state prominent">
            <b>Bank instrumen belum berisi data.</b>
            <span>
              Tambahkan instrumen pada Bank Instrumen Default sebelum menyusun
              rencana unit.
            </span>
            <a href="/questions">Buka Bank Instrumen Default</a>
          </div>
        ) : (
          <>
            {!defaultQuestionIds.length && (
              <div className="warning-box">
                Bank berisi {questions.length} instrumen, tetapi belum ada
                instrumen default untuk unit {plan.unit.name}. Pilih secara
                manual atau atur pemetaan unit.
              </div>
            )}

            <div className="instrument-toolbar">
              <input
                placeholder="Cari kode, pertanyaan, standar, klausul, atau proses…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={view}
                onChange={(event) =>
                  setView(event.target.value as InstrumentView)
                }
              >
                <option value="ALL">Semua instrumen</option>
                <option value="DEFAULT">Default unit</option>
                <option value="SELECTED">Sudah dipilih</option>
              </select>
            </div>

            <div className="instrument-actions">
              <button
                type="button"
                disabled={!defaultQuestionIds.length}
                onClick={selectDefaults}
              >
                Gunakan Default Unit ({defaultQuestionIds.length})
              </button>
              <button
                type="button"
                disabled={!filtered.length}
                onClick={selectFiltered}
              >
                Pilih Hasil Filter ({filtered.length})
              </button>
              <button
                type="button"
                disabled={!editor.questionIds.length}
                onClick={() => {
                  setEditor({ ...editor, questionIds: [] });
                  setNotice("Seluruh pilihan instrumen dikosongkan.");
                }}
              >
                Kosongkan Pilihan
              </button>
            </div>

            {notice && <div className="success-note">{notice}</div>}

            <div className="instrument-summary">
              <b>{editor.questionIds.length} dipilih</b>
              <span>{defaultQuestionIds.length} default unit</span>
              <span>{filtered.length} ditampilkan</span>
              <span>{questions.length} total aktif</span>
            </div>

            <div className="choice-list instrument-choice-list">
              {filtered.map((question) => {
                const questionId = String(question.id);
                return (
                  <label key={question.id} className="choice-row instrument-row">
                    <input
                      type="checkbox"
                      checked={editor.questionIds.includes(questionId)}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          questionIds: event.target.checked
                            ? [
                                ...new Set([
                                  ...editor.questionIds,
                                  questionId,
                                ]),
                              ]
                            : editor.questionIds.filter(
                                (id) => id !== questionId,
                              ),
                        })
                      }
                    />
                    <span>
                      <span className="instrument-title-line">
                        <b>
                          {question.code} · {question.moduleCode}
                        </b>
                        {question.mappedToUnit && (
                          <em className="default-marker">Default unit</em>
                        )}
                      </span>
                      <small>{question.question}</small>
                      <small className="meta-text">
                        {[question.standard?.code, question.isoClause?.code]
                          .filter(Boolean)
                          .join(" · ") || "Tanpa referensi standar"}
                      </small>
                    </span>
                  </label>
                );
              })}
              {!filtered.length && (
                <div className="empty-state">
                  Tidak ada instrumen yang cocok dengan pencarian dan filter.
                </div>
              )}
            </div>
          </>
        )}
      </fieldset>

      <div className="actions sticky-actions">
        <button
          type="button"
          className="primary fit"
          disabled={busy}
          onClick={onSave}
        >
          {busy ? "Menyimpan…" : "Simpan Rencana Unit"}
        </button>
        <button type="button" onClick={onCancel}>
          Batal
        </button>
        {editor.included && !editor.questionIds.length && (
          <span className="muted">
            Rencana dapat disimpan sebagai draft, tetapi ruang kerja belum dapat
            dibentuk.
          </span>
        )}
      </div>

      <style jsx>{`
        .unit-plan-editor {
          padding: 1.1rem;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .editor-heading,
        .instrument-toolbar,
        .instrument-actions,
        .instrument-summary,
        .field-heading {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .editor-heading {
          align-items: flex-start;
        }
        .editor-heading h3 {
          margin: 0.15rem 0 0.25rem;
          font-size: 1.25rem;
        }
        .editor-heading p {
          margin: 0;
          color: #64748b;
        }
        .eyebrow {
          color: #2563eb;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .target-switch {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 0.65rem;
          min-width: 260px;
          padding: 0.75rem;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          background: #eff6ff;
        }
        .target-switch input,
        .choice-row input {
          width: auto;
          margin-top: 0.2rem;
        }
        .target-switch small,
        .choice-row small {
          display: block;
          margin-top: 0.15rem;
          color: #64748b;
        }
        .editor-status-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          margin: 1rem 0;
        }
        .editor-status-grid > div {
          display: grid;
          gap: 0.2rem;
          padding: 0.65rem 0.8rem;
          border-radius: 9px;
          border: 1px solid;
        }
        .editor-status-grid small {
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          font-weight: 800;
        }
        .complete {
          border-color: #bbf7d0 !important;
          background: #f0fdf4;
          color: #166534;
        }
        .incomplete {
          border-color: #fed7aa !important;
          background: #fff7ed;
          color: #9a3412;
        }
        .editor-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .two-columns {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        fieldset {
          min-width: 0;
          border: 1px solid #cbd5e1;
          border-radius: 11px;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.9);
        }
        legend {
          padding: 0 0.45rem;
          font-weight: 800;
          color: #0f172a;
        }
        .field-heading {
          margin: 0.9rem 0 0.45rem;
        }
        .field-heading div {
          display: grid;
          gap: 0.1rem;
        }
        .field-heading small {
          color: #64748b;
        }
        .field-heading > span {
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          background: #e2e8f0;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .choice-list {
          border: 1px solid #dbe4ee;
          border-radius: 9px;
          overflow: auto;
          background: #fff;
        }
        .compact-choice-list {
          max-height: 220px;
        }
        .instrument-choice-list {
          max-height: 430px;
          margin-top: 0.75rem;
        }
        .choice-row {
          display: flex;
          flex-direction: row;
          gap: 0.7rem;
          align-items: flex-start;
          padding: 0.7rem;
          border-bottom: 1px solid #edf2f7;
          cursor: pointer;
        }
        .choice-row:hover {
          background: #f8fafc;
        }
        .choice-row:last-child {
          border-bottom: 0;
        }
        .choice-row > span {
          min-width: 0;
          flex: 1;
        }
        .deadline-intro {
          padding: 0.75rem;
          border-radius: 9px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .deadline-intro p {
          margin: 0.25rem 0 0;
          color: #64748b;
          font-size: 0.86rem;
        }
        .deadline-stack {
          display: grid;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        .deadline-stack > label {
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 0.65rem;
          align-items: start;
          padding: 0.75rem;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          background: #eff6ff;
        }
        .deadline-stack > label > span {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: #2563eb;
          color: #fff;
          font-weight: 800;
        }
        .deadline-stack div {
          display: grid;
          gap: 0.3rem;
        }
        .deadline-stack small {
          color: #64748b;
        }
        .info-box {
          margin-top: 0.75rem;
          padding: 0.75rem;
          border-radius: 9px;
          background: #fefce8;
          color: #854d0e;
          font-size: 0.85rem;
          line-height: 1.45;
        }
        .instrument-toolbar {
          justify-content: flex-start;
        }
        .instrument-toolbar input {
          flex: 1 1 420px;
        }
        .instrument-toolbar select {
          flex: 0 1 220px;
        }
        .instrument-actions {
          justify-content: flex-start;
          margin-top: 0.75rem;
        }
        .instrument-summary {
          justify-content: flex-start;
          margin-top: 0.75rem;
          padding: 0.65rem 0.8rem;
          border: 1px solid #dbe4ee;
          border-radius: 9px;
          background: #f8fafc;
        }
        .instrument-title-line {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .default-marker {
          display: inline-block;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 0.7rem;
          font-style: normal;
          font-weight: 700;
        }
        .meta-text {
          color: #64748b !important;
        }
        .empty-state,
        .warning-box,
        .success-note {
          padding: 0.9rem;
          border-radius: 9px;
        }
        .empty-state {
          color: #475569;
          background: #f1f5f9;
        }
        .empty-state.prominent {
          display: grid;
          gap: 0.45rem;
        }
        .warning-box {
          margin-bottom: 0.75rem;
          background: #fff7ed;
          color: #9a3412;
        }
        .success-note {
          margin-top: 0.75rem;
          background: #ecfdf5;
          color: #166534;
        }
        .sticky-actions {
          position: sticky;
          bottom: 0;
          z-index: 2;
          margin: 1rem -1.1rem -1.1rem;
          padding: 0.9rem 1.1rem;
          border-top: 1px solid #dbe4ee;
          background: rgba(248, 250, 252, 0.96);
          backdrop-filter: blur(8px);
        }
        @media (max-width: 980px) {
          .editor-grid,
          .two-columns {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 680px) {
          .editor-status-grid {
            grid-template-columns: 1fr;
          }
          .target-switch {
            min-width: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
