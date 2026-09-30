"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API, api } from "../lib/api";
import { InstrumentReviewPanel } from "./InstrumentReviewPanel";
import { AssessmentWorkflowPanel } from "./AssessmentWorkflowPanelV6";
import { WorkpaperPanel } from "./WorkpaperPanel";
import { FindingCapaPanel } from "./FindingCapaPanel";
import { ArchivePanel } from "./ArchivePanel";

const STEPS = [
  "Persiapan",
  "Instrumen",
  "Self-Assessment",
  "Pemeriksaan",
  "Lapangan",
  "Laporan",
  "Tindak Lanjut",
  "Verifikasi",
  "Selesai",
];

const STEP: Record<string, number> = {
  DRAFT: 0,
  FILE_PREPARATION: 0,
  INSTRUMENT_REVIEW: 1,
  INSTRUMENT_APPROVAL: 1,
  PUBLISHED: 2,
  SELF_ASSESSMENT: 2,
  DESK_REVIEW: 3,
  AUDIT: 4,
  FIELDWORK: 4,
  FIELD_AUDIT: 4,
  REPORTING: 5,
  REPORT_REVIEW: 7,
  FOLLOW_UP: 6,
  CLOSED: 8,
  ARCHIVED: 8,
  CANCELLED: 8,
};

const has = (user: any, ...roles: string[]) =>
  user.roles?.some((role: string) => roles.includes(role));

const label = (value: unknown) => {
  const text = String(value ?? "—");
  const labels: Record<string, string> = {
    BELUM_DIUKUR: "BELUM DIUKUR",
    KTS_MINOR: "KTS/NC MINOR",
    KTS_MAYOR: "KTS/NC MAYOR",
    DESK_ACCEPTED: "DITERIMA PADA DESK REVIEW",
    FIELD_PENDING: "MENUNGGU ASSESSMENT LAPANGAN",
  };
  return labels[text] || text.replaceAll("_", " ");
};

function tabsFor(data: any): Array<[string, string]> {
  const workspace = data?.workspace;
  if (!workspace) return [["overview", "Ringkasan"]];
  const currentStep = STEP[workspace.status] ?? 0;
  const tabs: Array<[string, string]> = [
    ["overview", "Ringkasan"],
    ["team", "Tim"],
    ["instrument", "Instrumen"],
  ];
  if (currentStep >= 2) {
    tabs.push([
      "assessment",
      workspace.status === "FIELD_AUDIT"
        ? "Assessment Lapangan"
        : "Penilaian & Bukti",
    ]);
  }
  if (currentStep >= 4 || (data.workpapers || []).length) {
    tabs.push(["workpaper", "Kertas Kerja"]);
  }
  if (
    currentStep >= 4 ||
    (data.findings || []).length ||
    (data.actions || []).length
  ) {
    tabs.push(["finding", "Temuan & CAPA"]);
  }
  if (currentStep >= 5) tabs.push(["report", "Laporan"]);
  if (["FOLLOW_UP", "REPORT_REVIEW", "CLOSED", "ARCHIVED"].includes(workspace.status)) {
    tabs.push(["archive", "Archive"]);
  }
  return tabs;
}

function stageInformation(workspace: any) {
  if (
    ["AUDITOR_REVIEW", "RETURNED"].includes(workspace.instrumentStatus)
  ) {
    return {
      owner: "Auditor; submit oleh Ketua Auditor unit",
      work: "Telaah pertanyaan dan perbaiki butir yang diperlukan.",
      output: "Instrumen dikirim kepada Verifikator.",
      next: "Auditor menelaah instrumen; Ketua Auditor unit melakukan submit.",
    };
  }
  if (workspace.instrumentStatus === "PENDING_VERIFICATION") {
    return {
      owner: "Verifikator",
      work: "Validasi setiap usulan perubahan instrumen.",
      output: "Instrumen dikembalikan atau disetujui untuk publikasi.",
      next: "Verifikator menetapkan Valid atau Tidak Valid pada setiap perubahan.",
    };
  }
  if (workspace.instrumentStatus === "APPROVED") {
    return {
      owner: "Admin Mutu",
      work: "Tetapkan tenggat Auditee dan review Auditor, lalu publikasikan.",
      output: "Self-assessment dibuka untuk Auditee.",
      next: "Admin Mutu menetapkan tenggat dan mempublikasikan instrumen.",
    };
  }

  const byStatus: Record<string, any> = {
    FILE_PREPARATION: {
      owner: "Admin Mutu",
      work: "Lengkapi tim, instrumen, dan tenggat awal.",
      output: "Ruang kerja siap untuk telaah instrumen.",
      next: "Lengkapi tim dan instrumen sesuai rencana unit.",
    },
    SELF_ASSESSMENT: {
      owner: "Auditee",
      work: "Isi jawaban serta unggah file atau tempel link Google Drive.",
      output: "Self-assessment dikirim untuk review Auditor.",
      next: "Auditee melengkapi jawaban dan bukti.",
    },
    DESK_REVIEW: {
      owner: "Auditor / Ketua Auditor",
      work: "Buka file, nilai ulang bukti Valid/Tidak Valid, lalu terima atau kembalikan butir.",
      output: "Hasil review dikirim kepada Admin Mutu.",
      next: "Auditor memeriksa semua jawaban dan bukti.",
    },
    AUDIT: {
      owner: "Admin Mutu",
      work: "Putuskan lanjut, kembalikan review, atau ganti Auditor.",
      output: "Assessment lapangan dibuka atau review diulang.",
      next: "Admin Mutu menetapkan keputusan atas review Auditor.",
    },
    FIELD_AUDIT: {
      owner: "Auditor",
      work: "Nilai seluruh butir dan isi bukti objektif serta analisis.",
      output: "Kertas kerja dan temuan terbentuk otomatis.",
      next: "Auditor menilai seluruh butir assessment lapangan.",
    },
    REPORTING: {
      owner: "Auditor / Ketua Auditor",
      work: "Ajukan dan sahkan seluruh kertas kerja, lalu buat versi laporan.",
      output: "Pelaporan selesai dan CAPA dibuka bila terdapat temuan.",
      next: "Finalkan kertas kerja dan laporan audit.",
    },
    FOLLOW_UP: {
      owner: "Auditee → Auditor → Ketua Auditor",
      work: "Auditee melaksanakan CAPA, Auditor merekomendasikan, Ketua Auditor memutuskan efektivitas.",
      output: "Semua temuan ditutup.",
      next: "Selesaikan CAPA dan verifikasi efektivitas.",
    },
    REPORT_REVIEW: {
      owner: "Admin Mutu",
      work: "Periksa dokumen Archive bertanda tangan dan pastikan seluruh temuan telah ditutup.",
      output: "Dokumen Archive dinyatakan valid dan audit unit ditutup.",
      next: "Admin Mutu memvalidasi Archive lalu menyelesaikan audit unit.",
    },
    CLOSED: {
      owner: "Sistem",
      work: "Audit selesai.",
      output: "Dokumen tersimpan sebagai rekaman audit.",
      next: "Audit telah ditutup.",
    },
  };
  return (
    byStatus[workspace.status] || {
      owner: "Tim sesuai penugasan",
      work: "Kerjakan tindakan yang tersedia pada tahap aktif.",
      output: "Tahap berikutnya terbuka setelah pekerjaan selesai.",
      next: "Lanjutkan sesuai tahapan dan kewenangan.",
    }
  );
}

export function AmiAuditWorkspace({ id, user }: { id: string; user: any }) {
  const search = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<any>({ role: "AUDITOR", userId: "" });

  const load = async () => setData(await api(`/audit-flow/${id}`));

  useEffect(() => {
    load().catch((reason: any) => setError(reason.message));
  }, [id]);

  useEffect(() => {
    const value = (search.get("tab") || "").toLowerCase();
    const aliases: Record<string, string> = {
      team: "team",
      "tim audit": "team",
      instrument: "instrument",
      instrumen: "instrument",
      assessment: "assessment",
      penilaian: "assessment",
      workpaper: "workpaper",
      "kertas kerja": "workpaper",
      finding: "finding",
      findings: "finding",
      temuan: "finding",
      report: "report",
      laporan: "report",
      archive: "archive",
      arsip: "archive",
      overview: "overview",
      ringkasan: "overview",
    };
    if (aliases[value]) setTab(aliases[value]);
  }, [search]);

  const workspaceTabs = useMemo(() => tabsFor(data), [data]);

  useEffect(() => {
    if (!workspaceTabs.some(([value]) => value === tab)) setTab("overview");
  }, [workspaceTabs, tab]);

  async function run(
    path: string,
    init?: RequestInit,
    success = "Perubahan disimpan.",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, init);
      await load();
      setMessage(success);
      return true;
    } catch (reason: any) {
      setError(reason.message || "Proses gagal.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data?.workspace) {
    return <div className="empty">Memuat ruang kerja AMI…</div>;
  }

  const workspace = data.workspace;
  const questions = data.questions || [];
  const currentStep = STEP[workspace.status] ?? 0;
  const myAssignment = workspace.team?.find(
    (member: any) => member.userId === user.id,
  )?.role;
  const canPrepare =
    has(user, "SUPER_ADMIN", "ADMIN_MUTU") &&
    ["DRAFT", "FILE_PREPARATION", "INSTRUMENT_REVIEW"].includes(
      workspace.status,
    );
  const stage = stageInformation(workspace);

  return (
    <div className="ami-workspace">
      <div className="page-title">
        <div>
          <a className="back" href="/audit-workspaces">
            ← Ruang Kerja Audit
          </a>
          <h1>{workspace.unit.name}</h1>
          <p>
            {workspace.program?.name || "Program audit"} · {workspace.auditYear} ·{" "}
            {workspace.name}
          </p>
        </div>
        <div className="status-stack">
          <span className="badge">Audit: {label(workspace.status)}</span>
          <span className="badge">
            Instrumen: {label(workspace.instrumentStatus)}
          </span>
          {myAssignment && (
            <span className="badge">Tugas: {label(myAssignment)}</span>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <section className="ami-next-action">
        <div>
          <small>PEKERJAAN BERIKUTNYA</small>
          <b>{stage.next}</b>
        </div>
        <span>
          {busy
            ? "Memproses…"
            : `Tahap ${currentStep + 1} dari ${STEPS.length}`}
        </span>
      </section>

      <section className="ami-panel stage-guide-panel">
        <div className="ami-panel-title">
          <div>
            <h2>Alur Tahap Ini</h2>
            <p>Menu dan tindakan mengikuti status aktif ruang kerja.</p>
          </div>
        </div>
        <div className="stage-guide-grid">
          <div><b>Penanggung jawab</b><p>{stage.owner}</p></div>
          <div><b>Pekerjaan</b><p>{stage.work}</p></div>
          <div><b>Hasil tahap</b><p>{stage.output}</p></div>
        </div>
      </section>

      <ol className="ami-stepper">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={
              index < currentStep ? "done" : index === currentStep ? "active" : ""
            }
          >
            <span>{index + 1}</span>
            <b>{step}</b>
          </li>
        ))}
      </ol>

      <nav className="ami-tabs">
        {workspaceTabs.map(([value, name]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {name}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="ami-grid">
          <article className="ami-panel">
            <h2>Identitas audit</h2>
            <Info name="Program" value={workspace.program?.name} />
            <Info name="Unit" value={workspace.unit.name} />
            <Info name="Tahun" value={workspace.auditYear} />
            <Info name="Status" value={label(workspace.status)} />
          </article>
          <article className="ami-panel">
            <h2>Progres rekaman</h2>
            <Info name="Pertanyaan" value={workspace._count.questions} />
            <Info name="Bukti" value={workspace._count.evidences} />
            <Info name="Kertas kerja" value={(data.workpapers || []).length} />
            <Info name="Temuan" value={workspace._count.findings} />
            <Info name="CAPA" value={workspace._count.actions} />
          </article>
          <article className="ami-panel ami-span-two">
            <h2>Kategori hasil assessment lapangan</h2>
            <div className="stage-guide-grid">
              <div>
                <b>SPMI</b>
                <p>Melampaui, Tercapai, Tidak Tercapai, Belum Diukur.</p>
                <small>Tidak Tercapai dan Belum Diukur menjadi temuan.</small>
              </div>
              <div>
                <b>ISO 9001:2015</b>
                <p>C, OBS, KTS/NC Minor, KTS/NC Mayor, NA.</p>
                <small>Semua selain C menjadi temuan.</small>
              </div>
            </div>
          </article>
        </section>
      )}

      {tab === "team" && (
        <section className="ami-panel">
          <h2>Tim Audit dan Verifikator</h2>
          {canPrepare && (
            <form
              className="ami-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  `/audit-flow/workspaces/${id}/team`,
                  { method: "POST", body: JSON.stringify(team) },
                  "Personel ditugaskan.",
                );
              }}
            >
              <select
                value={team.role}
                onChange={(event) =>
                  setTeam({ role: event.target.value, userId: "" })
                }
              >
                <option value="LEAD_AUDITOR">Ketua Auditor</option>
                <option value="AUDITOR">Auditor</option>
                <option value="VERIFIER">Verifikator Instrumen</option>
              </select>
              <select
                required
                value={team.userId}
                onChange={(event) =>
                  setTeam({ ...team, userId: event.target.value })
                }
              >
                <option value="">Pilih personel</option>
                {(data.users || [])
                  .filter(
                    (candidate: any) =>
                      candidate.unitId !== workspace.unitId &&
                      !workspace.team.some(
                        (member: any) => member.userId === candidate.id,
                      ) &&
                      candidate.roles?.some((mapping: any) =>
                        ({
                          LEAD_AUDITOR: ["KETUA_AUDITOR"],
                          AUDITOR: ["AUDITOR", "KETUA_AUDITOR"],
                          VERIFIER: ["VERIFIKATOR"],
                        } as any)[team.role]?.includes(mapping.role.code),
                      ),
                  )
                  .map((candidate: any) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} · {candidate.unit?.name || "Tanpa unit"}
                    </option>
                  ))}
              </select>
              <button className="primary" disabled={busy}>Tetapkan</button>
            </form>
          )}
          <div className="table-wrap">
            <table className="ami-table">
              <thead>
                <tr><th>Nama</th><th>Unit asal</th><th>Penugasan</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {workspace.team.length ? (
                  workspace.team.map((member: any) => (
                    <tr key={member.id}>
                      <td>{member.user.fullName}</td>
                      <td>{member.user.unit?.name || "—"}</td>
                      <td>{label(member.role)}</td>
                      <td>
                        {canPrepare && (
                          <button
                            type="button"
                            className="small danger"
                            onClick={() =>
                              confirm(`Hapus penugasan ${member.user.fullName}?`) &&
                              run(
                                `/audit-flow/workspaces/${id}/team/${member.id}`,
                                { method: "DELETE" },
                                "Penugasan dihapus.",
                              )
                            }
                          >Hapus</button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4}>Tim audit belum ditetapkan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "instrument" && (
        <InstrumentReviewPanel
          workspace={workspace}
          questions={questions}
          user={user}
          myAssignment={myAssignment}
          busy={busy}
          run={run}
        />
      )}

      {tab === "assessment" && (
        <AssessmentWorkflowPanel
          workspace={workspace}
          user={user}
          myAssignment={myAssignment}
          busy={busy}
          run={run}
        />
      )}

      {tab === "workpaper" && (
        <WorkpaperPanel
          workspace={workspace}
          data={data}
          user={user}
          myAssignment={myAssignment}
          busy={busy}
          run={run}
        />
      )}

      {tab === "finding" && (
        <FindingCapaPanel
          workspace={workspace}
          data={data}
          user={user}
          myAssignment={myAssignment}
          busy={busy}
          run={run}
        />
      )}

      {tab === "report" && (
        <section className="ami-grid">
          <article className="ami-panel">
            <h2>Ringkasan hasil</h2>
            <Info name="Pertanyaan" value={questions.length} />
            <Info name="Bukti" value={(data.evidences || []).length} />
            <Info name="Kertas kerja" value={(data.workpapers || []).length} />
            <Info name="Temuan" value={(data.findings || []).length} />
            <Info name="CAPA" value={(data.actions || []).length} />
          </article>
          <article className="ami-panel">
            <h2>Dokumen Laporan</h2>
            <p className="muted">
              Setiap versi merupakan PDF aktif yang dibentuk dari data audit saat dibuka.
            </p>
            <div className="ami-actions report-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    `/audit-flow/workspaces/${id}/print`,
                    {
                      method: "POST",
                      body: JSON.stringify({ type: "AUDIT_REPORT" }),
                    },
                    "Versi laporan PDF dibuat.",
                  )
                }
              >
                Buat Versi Laporan PDF
              </button>
              <a
                className="small link-button"
                href={`/audit-print/${id}`}
                target="_blank"
                rel="noreferrer"
              >
                Pratinjau Laporan
              </a>
            </div>
            <div className="table-wrap">
              <table className="ami-table">
                <thead>
                  <tr>
                    <th>Jenis</th><th>Nama</th><th>Versi</th><th>Status</th><th>Dokumen</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.prints || []).length ? (
                    data.prints.map((item: any) => (
                      <tr key={item.id}>
                        <td>{label(item.type)}</td>
                        <td>{item.fileName}</td>
                        <td>{item.version}</td>
                        <td>{label(item.status)}</td>
                        <td>
                          <div className="ami-actions">
                            <a
                              className="small link-button"
                              href={`${API}/audit-flow/print-documents/${item.id}/file?download=0`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Buka PDF
                            </a>
                            <a
                              className="small link-button"
                              href={`${API}/audit-flow/print-documents/${item.id}/file?download=1`}
                            >
                              Unduh PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5}>Belum ada versi laporan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

    {tab === "archive" && (
      <ArchivePanel
        workspace={workspace}
        user={user}
        myAssignment={myAssignment}
        busy={busy}
        run={run}
      />
    )}

    <style jsx>{`
        .stage-guide-panel { margin: 1rem 0; }
        .stage-guide-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: .75rem;
        }
        .stage-guide-grid > div {
          padding: .8rem;
          border: 1px solid #dbe4ee;
          border-radius: 10px;
          background: #f8fafc;
        }
        .stage-guide-grid p { margin: .3rem 0; }
        .stage-guide-grid small { color: #64748b; }
        .report-actions { margin-bottom: 1rem; }
        @media (max-width: 900px) {
          .stage-guide-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function Info({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="ami-info">
      <span>{name}</span>
      <b>{String(value ?? "—")}</b>
    </div>
  );
}
