"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

function destination(item: any) {
  if (!item.workspaceId) return "/dashboard";
  const event = String(item.event || "");
  const tab = event.startsWith("INSTRUMENT_")
    ? "instrument"
    : event.startsWith("SELF_ASSESSMENT_")
      ? "assessment"
      : event.startsWith("WORKPAPER_")
        ? "workpaper"
        : event.startsWith("FINDING_") ||
            event.startsWith("CORRECTIVE_") ||
            event.startsWith("VERIFICATION_") ||
            event.startsWith("ACTION_")
          ? "finding"
          : event.startsWith("REPORT_")
            ? "report"
            : "overview";
  return `/audit-workspaces/${item.workspaceId}?tab=${tab}`;
}

function relativeDate(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return new Date(value).toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export function NotificationBell() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const rows = await api("/notification-center");
      setItems(Array.isArray(rows) ? rows : []);
      setError("");
    } catch (reason: any) {
      setError(reason.message || "Notifikasi gagal dimuat.");
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  async function openItem(item: any) {
    if (!item.readAt) {
      await api(`/notification-center/${item.id}/read`, { method: "PATCH", body: "{}" });
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
        ),
      );
    }
    setOpen(false);
    router.push(destination(item));
  }

  async function markAllRead() {
    await api("/notification-center/read-all", { method: "PATCH", body: "{}" });
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || now })));
  }

  return (
    <div className="notification-root" ref={root}>
      <button
        type="button"
        className="notification-bell"
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) load();
        }}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>

      {open && (
        <div className="notification-popover">
          <header>
            <div>
              <strong>Notifikasi</strong>
              <small>{unread} belum dibaca</small>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAllRead}>Tandai semua dibaca</button>
            )}
          </header>
          {error && <div className="notification-error">{error}</div>}
          <div className="notification-list">
            {items.length ? (
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${item.readAt ? "read" : "unread"}`}
                  onClick={() => openItem(item)}
                >
                  <span className="notification-dot" />
                  <span>
                    <b>{item.title}</b>
                    <small>{item.message}</small>
                    <em>{relativeDate(item.createdAt)}</em>
                  </span>
                </button>
              ))
            ) : (
              <div className="notification-empty">Belum ada notifikasi.</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .notification-root { position: relative; }
        .notification-bell {
          position: relative; width: 40px; height: 40px; border-radius: 12px;
          border: 1px solid #dbe4ee; background: #fff; cursor: pointer; font-size: 18px;
        }
        .notification-bell b {
          position: absolute; right: -5px; top: -6px; min-width: 19px; height: 19px;
          padding: 0 5px; border-radius: 999px; background: #dc2626; color: #fff;
          font-size: 11px; line-height: 19px;
        }
        .notification-popover {
          position: absolute; right: 0; top: 48px; width: min(390px, calc(100vw - 32px));
          z-index: 80; border: 1px solid #dbe4ee; border-radius: 14px; background: #fff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, .2); overflow: hidden;
        }
        header { display: flex; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #edf2f7; }
        header div, .notification-item span:nth-child(2) { display: flex; flex-direction: column; gap: 3px; }
        header small { color: #64748b; }
        header button { border: 0; background: transparent; color: #1d4ed8; cursor: pointer; font-size: 12px; }
        .notification-list { max-height: 430px; overflow: auto; }
        .notification-item {
          width: 100%; display: grid; grid-template-columns: 9px 1fr; gap: 10px;
          padding: 13px 16px; border: 0; border-bottom: 1px solid #edf2f7;
          background: #fff; text-align: left; cursor: pointer;
        }
        .notification-item.unread { background: #eff6ff; }
        .notification-item:hover { background: #f8fafc; }
        .notification-dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 999px; background: transparent; }
        .unread .notification-dot { background: #2563eb; }
        .notification-item small { color: #475569; line-height: 1.35; }
        .notification-item em { color: #94a3b8; font-size: 11px; font-style: normal; }
        .notification-error { margin: 10px; padding: 9px; background: #fee2e2; color: #b91c1c; border-radius: 8px; }
        .notification-empty { padding: 28px 16px; text-align: center; color: #64748b; }
      `}</style>
    </div>
  );
}
