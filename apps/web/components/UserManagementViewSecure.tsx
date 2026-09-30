"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";

function loginStatus(user: any) {
  const locked =
    user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now();
  if (locked) {
    return {
      label: "TERKUNCI",
      detail: `s.d. ${new Date(user.lockedUntil).toLocaleString("id-ID")}`,
    };
  }
  if (user.failedLoginAttempts > 0) {
    return {
      label: "PERLU PERHATIAN",
      detail: `${user.failedLoginAttempts} kali gagal`,
    };
  }
  return { label: "NORMAL", detail: "Tidak ada kegagalan login" };
}

function roleName(code: string) {
  const labels: Record<string, string> = {
    SUPER_ADMIN: "Master Admin",
    ADMIN_MUTU: "Admin Mutu",
    P4MP: "P4MP",
    AUDITOR: "Auditor",
    KETUA_AUDITOR: "Ketua Auditor",
    AUDITEE: "Auditee",
    VERIFIKATOR: "Verifikator",
    PIMPINAN: "Pimpinan",
  };
  return labels[code] || code.replaceAll("_", " ");
}

export function UserManagementViewSecure({
  currentUser,
}: {
  currentUser: any;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ roles: [], password: "" });
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [userRows, bootstrap] = await Promise.all([
        api("/user-admin/users"),
        api("/legacy/bootstrap"),
      ]);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setUnits(bootstrap.units || []);
      setRoles(bootstrap.roles || []);
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Data pengguna gagal dimuat.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        unitName: user.unit?.name || "",
        roleLabel: user.roles
          .map((item: any) => roleName(item.role.code))
          .join(", "),
        loginLabel: loginStatus(user).label,
      })),
    [users],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((user) => {
      if (statusFilter !== "ALL" && user.status !== statusFilter) return false;
      if (!query) return true;
      return [
        user.fullName,
        user.username,
        user.email,
        user.unitName,
        user.roleLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, search, statusFilter]);

  const userSort = useSortableRows(filteredRows, "fullName");
  const auditeeRoleId = roles.find((role) => role.code === "AUDITEE")?.id;
  const isAuditee = Boolean(
    auditeeRoleId && form.roles.includes(auditeeRoleId),
  );
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const inactiveCount = users.filter((user) => user.status === "INACTIVE").length;
  const lockedCount = users.filter(
    (user) => loginStatus(user).label === "TERKUNCI",
  ).length;

  function resetForm() {
    setForm({ roles: [], password: "" });
  }

  function toggleRole(id: string) {
    setForm((current: any) => {
      const removing = current.roles.includes(id);
      return {
        ...current,
        roles: removing
          ? current.roles.filter((roleId: string) => roleId !== id)
          : [...current.roles, id],
        ...(removing && id === auditeeRoleId
          ? { isUnitApprover: false }
          : {}),
      };
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      await api(form.id ? `/users/${form.id}` : "/users", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      resetForm();
      setOpen(false);
      setOk("Data pengguna berhasil disimpan.");
      await load();
    } catch (reason: any) {
      setError(reason.message || "Data pengguna gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  function edit(user: any) {
    setError("");
    setOk("");
    setForm({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email || "",
      unitId: user.unit?.id || "",
      roles: user.roles.map((item: any) => item.role.id),
      isUnitApprover: Boolean(user.isUnitApprover),
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleStatus(user: any) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await api(`/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      setOk(`Status ${user.fullName} berhasil diperbarui.`);
      await load();
    } catch (reason: any) {
      setError(reason.message || "Status akun gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  async function resetLogin(user: any) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await api(`/user-admin/users/${user.id}/reset-login`, {
        method: "POST",
        body: "{}",
      });
      setOk(`Kegagalan login ${user.fullName} telah direset.`);
      await load();
    } catch (reason: any) {
      setError(reason.message || "Status login gagal direset.");
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(user: any) {
    setError("");
    setOk("");
    setDeleteTarget(user);
    setDeleteConfirmation("");
  }

  async function deleteUser(event: React.FormEvent) {
    event.preventDefault();
    if (!deleteTarget || deleteConfirmation !== deleteTarget.username) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const result = await api(`/user-admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const preserved = Number(result?.preservedHistoricalRecords || 0);
      setOk(
        preserved
          ? `Akun ${deleteTarget.fullName} dihapus. ${preserved} rekaman historis tetap dipertahankan untuk jejak audit.`
          : `Akun ${deleteTarget.fullName} berhasil dihapus.`,
      );
      setDeleteTarget(null);
      setDeleteConfirmation("");
      await load();
    } catch (reason: any) {
      setError(reason.message || "Akun pengguna gagal dihapus.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    if (!resetTarget || newPassword.length < 8) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await api(`/user-admin/users/${resetTarget.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      setOk(
        `Password ${resetTarget.fullName} direset. Pengguna wajib menggantinya setelah login.`,
      );
      setResetTarget(null);
      setNewPassword("");
      await load();
    } catch (reason: any) {
      setError(reason.message || "Password gagal direset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-title user-page-title">
        <div>
          <span className="page-eyebrow">ADMINISTRASI AKSES</span>
          <h1>Pengguna &amp; Role</h1>
          <p>
            Kelola akun, unit, role, status akses, dan keamanan login pengguna.
          </p>
        </div>
        <button
          className="primary fit"
          onClick={() => {
            resetForm();
            setOpen((value) => !value);
          }}
        >
          {open && !form.id ? "Tutup Form" : "+ Tambah Pengguna"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {ok && <div className="success">{ok}</div>}

      <div className="user-summary-grid">
        <div>
          <small>TOTAL AKUN</small>
          <b>{users.length}</b>
          <span>terdaftar</span>
        </div>
        <div>
          <small>AKTIF</small>
          <b>{activeCount}</b>
          <span>dapat login</span>
        </div>
        <div>
          <small>NONAKTIF</small>
          <b>{inactiveCount}</b>
          <span>akses dihentikan</span>
        </div>
        <div>
          <small>TERKUNCI</small>
          <b>{lockedCount}</b>
          <span>perlu reset login</span>
        </div>
      </div>

      {open && (
        <form className="panel form-panel user-form" onSubmit={save}>
          <div className="form-heading">
            <div>
              <h2>{form.id ? "Edit Pengguna" : "Tambah Pengguna"}</h2>
              <p>
                Username tidak dapat diubah setelah akun dibuat. Role dapat
                diperbarui sesuai penugasan.
              </p>
            </div>
            {form.id && (
              <span className="editing-pill">Mengedit: {form.username}</span>
            )}
          </div>

          <div className="form-row">
            <label>
              Username
              <input
                required
                disabled={Boolean(form.id)}
                value={form.username || ""}
                onChange={(event) =>
                  setForm({ ...form, username: event.target.value })
                }
              />
            </label>
            <label>
              Nama lengkap
              <input
                required
                value={form.fullName || ""}
                onChange={(event) =>
                  setForm({ ...form, fullName: event.target.value })
                }
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Email
              <input
                type="email"
                value={form.email || ""}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label>
              Unit utama
              <select
                value={form.unitId || ""}
                onChange={(event) =>
                  setForm({ ...form, unitId: event.target.value })
                }
              >
                <option value="">Tanpa unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!form.id && (
            <label>
              Password awal
              <input
                required
                minLength={8}
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </label>
          )}

          <fieldset className="role-picker">
            <legend>Role pengguna</legend>
            <div className="role-grid">
              {roles.map((role) => (
                <label key={role.id}>
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <span>
                    <b>{roleName(role.code)}</b>
                    <small>{role.code}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {isAuditee && (
            <label className="checkbox-line approver-option">
              <input
                type="checkbox"
                checked={Boolean(form.isUnitApprover)}
                onChange={(event) =>
                  setForm({ ...form, isUnitApprover: event.target.checked })
                }
              />
              <span>
                <b>Pengesah unit</b>
                <small>
                  Berwenang mengesahkan self-assessment dan tindak lanjut unit.
                </small>
              </span>
            </label>
          )}

          <div className="actions">
            <button className="primary fit" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Pengguna"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <section className="panel user-list-panel">
        <div className="section-header user-list-heading">
          <div>
            <h2>Daftar Pengguna</h2>
            <small>{filteredRows.length} akun ditampilkan</small>
          </div>
          <div className="user-filters">
            <input
              placeholder="Cari nama, username, unit, atau role…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
              <option value="LOCKED">Terkunci</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table user-table">
            <thead>
              <tr>
                <SortableTh
                  label="Nama"
                  column="fullName"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <SortableTh
                  label="Username"
                  column="username"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <SortableTh
                  label="Unit"
                  column="unitName"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <SortableTh
                  label="Role"
                  column="roleLabel"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <SortableTh
                  label="Status Akun"
                  column="status"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <SortableTh
                  label="Status Login"
                  column="loginLabel"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <th>Password</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {userSort.sorted.map((user) => {
                const access = loginStatus(user);
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="identity-cell">
                        <b>{user.fullName}</b>
                        <small>{user.email || "Tanpa email"}</small>
                      </div>
                    </td>
                    <td>{user.username}</td>
                    <td>{user.unit?.name || "—"}</td>
                    <td>
                      <div className="role-chips">
                        {user.roles.map((item: any) => (
                          <span key={item.role.id}>
                            {roleName(item.role.code)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          user.status === "INACTIVE" ? "warning" : ""
                        }`}
                      >
                        {user.status === "ACTIVE" ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          access.label === "TERKUNCI" ? "danger" : ""
                        }`}
                      >
                        {access.label}
                      </span>
                      <small className="access-detail">{access.detail}</small>
                    </td>
                    <td>
                      <span className="secure-password">Terenkripsi</span>
                      <small className="access-detail">Tidak dapat dilihat</small>
                    </td>
                    <td className="user-actions">
                      <button className="small" onClick={() => edit(user)}>
                        Edit
                      </button>
                      <button
                        className="small"
                        disabled={busy}
                        onClick={() => toggleStatus(user)}
                      >
                        {user.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        className="small"
                        disabled={busy}
                        onClick={() => {
                          setResetTarget(user);
                          setNewPassword("");
                        }}
                      >
                        Reset Password
                      </button>
                      {(user.failedLoginAttempts > 0 || user.lockedUntil) && (
                        <button
                          className="small"
                          disabled={busy}
                          onClick={() => resetLogin(user)}
                        >
                          Reset Login
                        </button>
                      )}
                      {user.id !== currentUser.id && (
                        <button
                          className="small danger"
                          disabled={busy}
                          onClick={() => requestDelete(user)}
                        >
                          Hapus Akun
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!userSort.sorted.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-user-state">
                      Tidak ada pengguna yang sesuai dengan pencarian.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resetTarget && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <form className="user-dialog" onSubmit={submitPasswordReset}>
            <span className="dialog-eyebrow">KEAMANAN AKUN</span>
            <h3>Reset Password</h3>
            <p>
              Tetapkan password sementara untuk <b>{resetTarget.fullName}</b>.
              Password lama tidak dapat dibaca karena tersimpan sebagai hash.
            </p>
            <label>
              Password sementara baru
              <input
                autoFocus
                required
                minLength={8}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <small>Minimal 8 karakter dan wajib diganti setelah login.</small>
            <div className="actions dialog-actions">
              <button type="button" onClick={() => setResetTarget(null)}>
                Batal
              </button>
              <button
                className="primary"
                disabled={busy || newPassword.length < 8}
              >
                Reset Password
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <form className="user-dialog delete-dialog" onSubmit={deleteUser}>
            <span className="dialog-eyebrow danger-text">PENGHAPUSAN AKUN</span>
            <h3>Hapus akun {deleteTarget.fullName}?</h3>
            <p>
              Akun akan dinonaktifkan permanen, seluruh sesi dihentikan, dan
              username serta email dibebaskan. Rekaman historis audit tetap
              dipertahankan sebagai jejak audit.
            </p>
            <div className="delete-warning">
              Tindakan ini tidak dapat dibatalkan dari antarmuka aplikasi.
            </div>
            <label>
              Ketik username <b>{deleteTarget.username}</b> untuk konfirmasi
              <input
                autoFocus
                required
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
              />
            </label>
            <div className="actions dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmation("");
                }}
              >
                Batal
              </button>
              <button
                className="danger"
                disabled={
                  busy || deleteConfirmation !== deleteTarget.username
                }
              >
                {busy ? "Menghapus…" : "Hapus Akun Permanen"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .page-eyebrow,
        .dialog-eyebrow {
          display: block;
          margin-bottom: 0.3rem;
          color: #2563eb;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .danger-text {
          color: #dc2626;
        }
        .user-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .user-summary-grid > div {
          display: grid;
          gap: 0.15rem;
          padding: 0.85rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.04);
        }
        .user-summary-grid small {
          color: #64748b;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.07em;
        }
        .user-summary-grid b {
          font-size: 1.4rem;
        }
        .user-summary-grid span {
          color: #64748b;
          font-size: 0.8rem;
        }
        .user-form {
          margin-bottom: 1rem;
        }
        .form-heading,
        .user-list-heading,
        .user-filters {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .form-heading h2,
        .form-heading p {
          margin: 0;
        }
        .form-heading p {
          margin-top: 0.2rem;
          color: #64748b;
        }
        .editing-pill {
          padding: 0.3rem 0.55rem;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .role-picker {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 0.9rem;
        }
        .role-picker legend {
          padding: 0 0.4rem;
          font-weight: 800;
        }
        .role-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.55rem;
        }
        .role-grid label,
        .approver-option {
          display: flex;
          flex-direction: row;
          gap: 0.55rem;
          align-items: flex-start;
          padding: 0.65rem;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #f8fafc;
        }
        .role-grid input,
        .approver-option input {
          width: auto;
          margin-top: 0.2rem;
        }
        .role-grid small,
        .approver-option small {
          display: block;
          margin-top: 0.1rem;
          color: #64748b;
        }
        .user-list-panel {
          padding: 0;
          overflow: hidden;
        }
        .user-list-heading {
          padding: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .user-filters {
          justify-content: flex-end;
        }
        .user-filters input {
          min-width: 300px;
        }
        .user-filters select {
          min-width: 150px;
        }
        .user-table {
          min-width: 1320px;
        }
        .identity-cell {
          display: grid;
          gap: 0.15rem;
        }
        .identity-cell small {
          color: #64748b;
        }
        .role-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }
        .role-chips span {
          padding: 0.18rem 0.4rem;
          border-radius: 999px;
          background: #f1f5f9;
          color: #334155;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .access-detail {
          display: block;
          margin-top: 4px;
          color: #64748b;
          white-space: nowrap;
        }
        .secure-password {
          font-weight: 700;
          color: #475569;
        }
        .user-actions {
          min-width: 350px;
        }
        .user-actions button {
          margin: 2px;
        }
        .empty-user-state {
          display: grid;
          place-items: center;
          min-height: 120px;
          color: #64748b;
        }
        .user-modal {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.58);
          backdrop-filter: blur(3px);
        }
        .user-dialog {
          width: min(540px, 100%);
          padding: 1.4rem;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
        }
        .user-dialog h3 {
          margin: 0.15rem 0 0.5rem;
        }
        .user-dialog p {
          color: #475569;
          line-height: 1.5;
        }
        .delete-dialog {
          border-top: 4px solid #dc2626;
        }
        .delete-warning {
          margin: 0.75rem 0;
          padding: 0.75rem;
          border-radius: 9px;
          background: #fef2f2;
          color: #991b1b;
          font-weight: 700;
        }
        .dialog-actions {
          justify-content: flex-end;
          margin-top: 1rem;
        }
        @media (max-width: 1000px) {
          .user-summary-grid,
          .role-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 620px) {
          .user-summary-grid,
          .role-grid {
            grid-template-columns: 1fr;
          }
          .user-filters,
          .user-filters input,
          .user-filters select {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </>
  );
}
