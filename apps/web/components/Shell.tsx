"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { NotificationBell } from "./NotificationBell";

const groups = [
  [
    "UTAMA",
    [
      ["Dashboard", "/dashboard", ["*"]],
      ["Program Audit", "/audit-programs", ["SUPER_ADMIN", "ADMIN_MUTU"]],
      ["Ruang Kerja Audit", "/audit-workspaces", ["*"]],
    ],
  ],
  [
    "INSTRUMEN",
    [
      [
        "Bank Instrumen, ISO & SPMI",
        "/questions",
        ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "AUDITOR", "KETUA_AUDITOR"],
      ],
      [
        "Pemetaan Instrumen–Unit",
        "/instrument-mapping",
        ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP"],
      ],
      [
        "Verifikasi Perubahan",
        "/audit-workspaces?task=verification",
        ["VERIFIKATOR"],
      ],
    ],
  ],
  [
    "PELAKSANAAN",
    [
      [
        "Self-Assessment",
        "/audit-workspaces?task=assessment",
        ["AUDITEE", "AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN", "P4MP"],
      ],
      [
        "Kertas Kerja",
        "/audit-workspaces?task=workpaper",
        [
          "AUDITOR",
          "KETUA_AUDITOR",
          "ADMIN_MUTU",
          "SUPER_ADMIN",
          "P4MP",
          "PIMPINAN",
        ],
      ],
      [
        "Temuan & Tindak Lanjut",
        "/audit-workspaces?task=findings",
        ["AUDITEE", "AUDITOR", "KETUA_AUDITOR", "ADMIN_MUTU", "SUPER_ADMIN", "P4MP", "PIMPINAN"],
      ],
    ],
  ],
  [
    "LAPORAN",
    [
      ["Laporan", "/reports", ["*"]],
      ["Rekap Institusi", "/recap", ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"]],
      ["Evaluasi Keaktifan", "/activity-evaluation", ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"]],
    ],
  ],
  [
    "MASTER SISTEM",
    [
      ["Pengguna & Role", "/users", ["SUPER_ADMIN", "ADMIN_MUTU"]],
      ["Unit & Tupoksi", "/units", ["SUPER_ADMIN", "ADMIN_MUTU"]],
      ["Log Sistem", "/activity-logs", ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "PIMPINAN"]],
    ],
  ],
] as const;

const auditeeMenu = new Set([
  "/dashboard",
  "/audit-workspaces?task=assessment",
  "/audit-workspaces?task=findings",
  "/reports",
]);

export function Shell({ children, user }: { children: React.ReactNode; user: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const sideRef = useRef<HTMLElement>(null);
  const roles: string[] = user.roles || [];
  const pureAuditee = roles.length === 1 && roles[0] === "AUDITEE";

  useEffect(() => {
    const saved = Number(sessionStorage.getItem("sami-sidebar-scroll") || 0);
    if (sideRef.current) sideRef.current.scrollTop = saved;
  }, []);

  const roleLabel = (role: string) =>
    role === "SUPER_ADMIN" ? "Master Admin" : role.replaceAll("_", " ");
  const allowed = (rules: readonly string[]) =>
    rules.includes("*") || rules.some((role) => roles.includes(role));

  return (
    <div className="shell">
      <aside
        ref={sideRef}
        className="side"
        onScroll={(event) =>
          sessionStorage.setItem(
            "sami-sidebar-scroll",
            String(event.currentTarget.scrollTop),
          )
        }
      >
        <div className="brand">
          <div className="mark">SN</div>
          <div>
            <strong>SAMI-NONAK</strong>
            <small>POLBENG</small>
          </div>
        </div>
        <div className="user-mini">
          <span>{user.fullName?.slice(0, 1)}</span>
          <div>
            <b>{user.fullName}</b>
            <small>{roles.map(roleLabel).join(" · ")}</small>
            {user.isUnitApprover && <small>Approver unit</small>}
          </div>
        </div>
        <nav className="nav">
          {groups.map(([title, items]) => {
            const visible = items.filter(
              (item) =>
                allowed(item[2]) && (!pureAuditee || auditeeMenu.has(item[1])),
            );
            return visible.length ? (
              <div className="nav-group" key={title}>
                <label>{title}</label>
                {visible.map(([name, href]) => {
                  const basePath = href.split("?")[0];
                  const active =
                    pathname === basePath ||
                    (basePath !== "/dashboard" &&
                      pathname.startsWith(`${basePath}/`));
                  return (
                    <Link
                      className={active ? "active" : ""}
                      key={href}
                      href={href}
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
            ) : null;
          })}
        </nav>
        <button
          className="logout"
          onClick={async () => {
            await api("/auth/logout", { method: "POST" });
            router.push("/");
          }}
        >
          Keluar dari sistem
        </button>
      </aside>
      <main className="content">
        <header className="top">
          <div>
            <b>Audit Mutu Internal Nonakademik</b>
            <span>Standar Dikti/Internal dan Proses ISO 9001:2015</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <NotificationBell />
            <div className="top-role">{roleLabel(roles[0] || "")}</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
