"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { SortableTh, useSortableRows } from "./Sortable";
export function UserManagementView() {
  const [users, setUsers] = useState<any[]>([]),
    [units, setUnits] = useState<any[]>([]),
    [roles, setRoles] = useState<any[]>([]),
    [form, setForm] = useState<any>({ roles: [], password: "" }),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [ok, setOk] = useState("");
  const userSort = useSortableRows(
    users.map((user) => ({
      ...user,
      unitName: user.unit?.name || "",
      roleLabel: user.roles.map((role: any) => role.role.code).join(", "),
    })),
    "fullName",
  );
  const load = async () => {
    try {
      const [u, b] = await Promise.all([
        api("/users"),
        api("/legacy/bootstrap"),
      ]);
      setUsers(u);
      setUnits(b.units);
      setRoles(b.roles);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const auditeeRoleId = roles.find((role) => role.code === "AUDITEE")?.id;
  const isAuditee = Boolean(
    auditeeRoleId && form.roles.includes(auditeeRoleId),
  );
  const toggle = (id: string) =>
    setForm((current: any) => {
      const removing = current.roles.includes(id);
      return {
        ...current,
        roles: removing
          ? current.roles.filter((roleId: string) => roleId !== id)
          : [...current.roles, id],
        ...(removing && id === auditeeRoleId ? { isUnitApprover: false } : {}),
      };
    });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (form.id)
        await api(`/users/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      else await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ roles: [], password: "" });
      setOpen(false);
      setOk("Data pengguna berhasil disimpan.");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  function edit(x: any) {
    setForm({
      id: x.id,
      username: x.username,
      fullName: x.fullName,
      email: x.email || "",
      unitId: x.unit?.id || "",
      roles: x.roles.map((r: any) => r.role.id),
      isUnitApprover: Boolean(x.isUnitApprover),
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function status(x: any) {
    try {
      await api(`/users/${x.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: x.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Pengguna & Role</h1>
          <p>
            Akun, unit utama, status, dan role menjadi dasar penugasan
            workspace.
          </p>
        </div>
        <button
          className="primary fit"
          onClick={() => {
            setForm({ roles: [], password: "" });
            setOpen(!open);
          }}
        >
          + Tambah User
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {ok && <div className="success">{ok}</div>}
      {open && (
        <form className="panel form-panel" onSubmit={save}>
          <h2>{form.id ? "Edit Pengguna" : "Tambah Pengguna"}</h2>
          <div className="form-row">
            <label>
              Username
              <input
                required
                disabled={!!form.id}
                value={form.username || ""}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Nama lengkap
              <input
                required
                value={form.fullName || ""}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Email
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Unit utama
              <select
                value={form.unitId || ""}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              >
                <option value="">Tanpa unit</option>
                {units.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} — {x.name}
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
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          )}
          <fieldset className="role-picker">
            <legend>Role pengguna</legend>
            {roles.map((x) => (
              <label key={x.id}>
                <input
                  type="checkbox"
                  checked={form.roles.includes(x.id)}
                  onChange={() => toggle(x.id)}
                />
                <span>
                  {x.code === "SUPER_ADMIN" ? "Master Admin" : x.name}
                </span>
              </label>
            ))}
          </fieldset>
          {isAuditee && (
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={Boolean(form.isUnitApprover)}
                onChange={(event) =>
                  setForm({ ...form, isUnitApprover: event.target.checked })
                }
              />
              <span>
                Berwenang mengesahkan penilaian dan tindak lanjut unit
              </span>
            </label>
          )}
          <div className="actions">
            <button className="primary fit">Simpan Pengguna</button>
            <button type="button" onClick={() => setOpen(false)}>
              Batal
            </button>
          </div>
        </form>
      )}
      <div className="panel">
        <div className="section-header">
          <div>
            <h2>Daftar Pengguna &amp; Role</h2>
            <small>{users.length} akun terdaftar</small>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
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
                  label="Pengesah Unit"
                  column="isUnitApprover"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <SortableTh
                  label="Status"
                  column="status"
                  sort={userSort.sort}
                  onSort={userSort.toggle}
                />
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {userSort.sorted.map((x) => (
                <tr key={x.id}>
                  <td>{x.fullName}</td>
                  <td>{x.username}</td>
                  <td>{x.unit?.name || "—"}</td>
                  <td>
                    {x.roles
                      .map((r: any) =>
                        r.role.code === "SUPER_ADMIN"
                          ? "Master Admin"
                          : r.role.code,
                      )
                      .join(", ")}
                  </td>
                  <td>{x.isUnitApprover ? "Ya" : "—"}</td>
                  <td>
                    <span className="badge">{x.status}</span>
                  </td>
                  <td>
                    <button className="small" onClick={() => edit(x)}>
                      Edit
                    </button>{" "}
                    <button className="small" onClick={() => status(x)}>
                      {x.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
