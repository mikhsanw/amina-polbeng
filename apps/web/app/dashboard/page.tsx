import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell } from "../../components/Shell";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function get(path: string) {
  const cookieStore = await cookies();
  const response = await fetch(`${API}${path}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 401) redirect("/");
  if (!response.ok) throw new Error(`Gagal memuat ${path}`);
  return response.json();
}

export default async function Dashboard() {
  const [user, dashboard, workspaces] = await Promise.all([
    get("/auth/me"),
    get("/dashboard"),
    get("/audit-workspaces"),
  ]);

  const cards = [
    ["Unit aktif", dashboard.units],
    ["Audit dalam lingkup saya", dashboard.workspaces],
    ["Temuan terbuka", dashboard.openFindings],
    ["CAPA terlambat", dashboard.overdueActions],
    ["Notifikasi baru", dashboard.unreadNotifications],
  ];

  const roles: string[] = user.roles || [];
  const assignedInstrumentReview = workspaces.filter(
    (workspace: any) =>
      workspace.team?.some(
        (member: any) =>
          member.userId === user.id &&
          ["AUDITOR", "LEAD_AUDITOR"].includes(member.role),
      ) && ["AUDITOR_REVIEW", "RETURNED"].includes(workspace.instrumentStatus),
  ).length;
  const waitingVerifier = workspaces.filter(
    (workspace: any) =>
      workspace.team?.some(
        (member: any) =>
          member.userId === user.id &&
          ["AUDITOR", "LEAD_AUDITOR"].includes(member.role),
      ) && workspace.instrumentStatus === "PENDING_VERIFICATION",
  ).length;
  const readyActivation = workspaces.filter(
    (workspace: any) => workspace.instrumentStatus === "APPROVED",
  ).length;

  const tasks = (dashboard.tasks || []).filter(
    (task: any) => task.type !== "INSTRUMENT_REVIEW",
  );
  if (
    roles.some((role) => ["AUDITOR", "KETUA_AUDITOR"].includes(role)) &&
    assignedInstrumentReview
  ) {
    tasks.unshift({
      type: "ASSIGNED_INSTRUMENT_REVIEW",
      label: "Instrumen unit tugas perlu ditelaah",
      count: assignedInstrumentReview,
      href: "/audit-workspaces?task=instrument",
    });
  }
  if (
    roles.some((role) => ["AUDITOR", "KETUA_AUDITOR"].includes(role)) &&
    waitingVerifier
  ) {
    tasks.push({
      type: "INSTRUMENT_WAITING_VERIFIER",
      label: "Perbaikan instrumen menunggu Verifikator P4MP",
      count: waitingVerifier,
      href: "/audit-workspaces?task=pending-verification",
    });
  }
  if (
    roles.some((role) => ["SUPER_ADMIN", "ADMIN_MUTU"].includes(role)) &&
    readyActivation
  ) {
    tasks.push({
      type: "INSTRUMENT_READY_ACTIVATION",
      label: "Instrumen siap diaktifkan untuk self-assessment",
      count: readyActivation,
      href: "/audit-workspaces?task=activation",
    });
  }

  return (
    <Shell user={user}>
      <div className="page-title">
        <div>
          <h1>Dashboard Pekerjaan AMI-NA</h1>
          <p>
            Sistem menampilkan pekerjaan, keputusan, dan tenggat sesuai penugasan
            serta kewenangan Anda.
          </p>
        </div>
        <span className="count">{roles.join(" · ")}</span>
      </div>

      <section className="panel">
        <h2>Pekerjaan saya</h2>
        <div className="cards">
          {tasks.length ? (
            tasks.map((task: any) => (
              <Link className="card" href={task.href} key={task.type}>
                <div className="metric">{task.count}</div>
                <div className="label">{task.label}</div>
              </Link>
            ))
          ) : (
            <div className="empty">
              Belum ada tugas aktif yang memerlukan tindakan Anda.
            </div>
          )}
        </div>
      </section>

      <section className="cards">
        {cards.map(([name, value]) => (
          <div className="card" key={name}>
            <div className="metric">{value}</div>
            <div className="label">{name}</div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Audit aktif</h2>
        {workspaces.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Tahap</th>
                  <th>Instrumen</th>
                  <th>Perubahan</th>
                  <th>Temuan</th>
                  <th>Lanjutkan</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.slice(0, 12).map((workspace: any) => (
                  <tr key={workspace.id}>
                    <td>
                      <b>{workspace.unit.name}</b>
                      <br />
                      <small>{workspace.name}</small>
                    </td>
                    <td>
                      <span className="badge">
                        {workspace.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className="badge">
                        {workspace.instrumentStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{workspace.instrumentChangeCount || 0}</td>
                    <td>{workspace._count.findings}</td>
                    <td>
                      <Link href={`/audit-workspaces/${workspace.id}`}>
                        Buka pekerjaan →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Belum ada ruang kerja audit.</div>
        )}
      </section>
    </Shell>
  );
}
