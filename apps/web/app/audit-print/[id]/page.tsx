import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PrintButton } from "../../../components/PrintButton";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const label = (value: unknown) => String(value ?? "—").replaceAll("_", " ");

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const headers = { cookie: cookieStore.toString() };
  const [meResponse, auditResponse, signatoryResponse] = await Promise.all([
    fetch(`${API}/auth/me`, { headers, cache: "no-store" }),
    fetch(`${API}/audit-flow/${id}`, { headers, cache: "no-store" }),
    fetch(`${API}/audit-flow/workspaces/${id}/report-signatories`, {
      headers,
      cache: "no-store",
    }),
  ]);

  if (meResponse.status === 401) redirect("/");
  if (!auditResponse.ok) {
    return <main className="print-page">Data laporan tidak dapat dibuka.</main>;
  }

  const user = await meResponse.json();
  const data = await auditResponse.json();
  const signatories = signatoryResponse.ok
    ? await signatoryResponse.json()
    : { auditee: null, leadAuditor: null, auditors: [] };
  const workspace = data.workspace;
  const team = workspace.team || [];
  const questions = data.questions || [];
  const evidences = data.evidences || [];
  const findings = data.findings || [];
  const actions = data.actions || [];
  const auditors = team.filter((member: any) =>
    ["LEAD_AUDITOR", "AUDITOR"].includes(member.role),
  );

  return (
    <main className="print-page">
      <PrintButton />
      <header className="print-head">
        <img
          className="print-logo-image"
          src="/polbeng-logo.jpg"
          alt="Logo Politeknik Negeri Bengkalis"
        />
        <div>
          <h1>LAPORAN AUDIT MUTU INTERNAL NONAKADEMIK</h1>
          <p>POLITEKNIK NEGERI BENGKALIS</p>
        </div>
      </header>

      <section className="print-info">
        <b>Kode/Program</b>
        <span>
          {workspace.program?.code || "—"} — {workspace.program?.name || "—"}
        </span>
        <b>Unit Auditee</b>
        <span>{workspace.unit.name}</span>
        <b>Tahun/Status</b>
        <span>
          {workspace.auditYear} / {label(workspace.status)}
        </span>
        <b>Tim Auditor</b>
        <span>
          {auditors.length
            ? auditors
                .map(
                  (member: any) =>
                    `${member.user.fullName} (${label(member.role)})`,
                )
                .join(", ")
            : "—"}
        </span>
      </section>

      <h2>Ringkasan</h2>
      <table className="print-table">
        <tbody>
          <tr>
            <th>Instrumen</th>
            <td>{questions.length}</td>
            <th>Bukti</th>
            <td>{evidences.length}</td>
            <th>Temuan</th>
            <td>{findings.length}</td>
          </tr>
        </tbody>
      </table>

      <h2>Daftar Temuan dan Tindak Lanjut</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Jenis</th>
            <th>Kondisi</th>
            <th>Risiko</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {findings.length ? (
            findings.map((finding: any) => (
              <tr key={finding.id}>
                <td>{finding.code}</td>
                <td>{label(finding.findingType)}</td>
                <td>{finding.condition}</td>
                <td>{finding.riskImpact}</td>
                <td>{label(finding.status)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>Tidak terdapat temuan audit.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Hasil Verifikasi</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>Temuan</th>
            <th>Tindakan</th>
            <th>Progres</th>
            <th>Keputusan</th>
          </tr>
        </thead>
        <tbody>
          {actions.length ? (
            actions.map((action: any) => (
              <tr key={action.id}>
                <td>{action.finding.code}</td>
                <td>{action.correctiveAction}</td>
                <td>{action.progressPercent}%</td>
                <td>{label(action.verifications?.at(-1)?.status)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>Belum ada tindak lanjut.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Pengesahan Laporan</h2>
      <section className="signature-grid">
        <div>
          <b>Auditee / Pimpinan Unit</b>
          <span className="signature-space" />
          <strong>{signatories.auditee?.fullName || "Belum ditetapkan"}</strong>
        </div>
        <div>
          <b>Ketua Auditor</b>
          <span className="signature-space" />
          <strong>
            {signatories.leadAuditor?.fullName || "Belum ditetapkan"}
          </strong>
        </div>
        <div>
          <b>Auditor</b>
          <span className="signature-space" />
          <strong>
            {signatories.auditors?.length
              ? signatories.auditors
                  .map((auditor: any) => auditor.fullName)
                  .join(", ")
              : "Belum ditetapkan"}
          </strong>
        </div>
      </section>

      <footer>
        Dicetak oleh {user.fullName} pada {new Date().toLocaleString("id-ID")} ·
        SAMI-NONAK POLBENG
      </footer>

      <style>{`
        .print-logo-image {
          width: 64px;
          height: 64px;
          flex: 0 0 64px;
          object-fit: contain;
          background: #fff;
        }
        .signature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
          margin: 24px 0 42px;
          page-break-inside: avoid;
        }
        .signature-grid > div {
          min-height: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .signature-space {
          flex: 1;
          min-height: 90px;
          width: 100%;
          border-bottom: 1px solid #111827;
        }
        .signature-grid strong {
          margin-top: 8px;
        }
        @media (max-width: 720px) {
          .signature-grid { grid-template-columns: 1fr; }
        }
        @media print {
          .print-logo-image { width: 64px; height: 64px; }
          .signature-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
      `}</style>
    </main>
  );
}
