"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      router.push("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/polbeng-logo.jpg" alt="Logo Politeknik Negeri Bengkalis" />
          <div>
            <h1>SAMI-NONAK POLBENG</h1>
            <div className="subtitle">Audit Mutu Internal Nonakademik</div>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <label className="field">
          Username
          <input name="username" autoComplete="username" required />
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Memverifikasi…" : "Masuk"}
        </button>
        <style jsx>{`
          .login-brand {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
          }
          .login-brand img {
            width: 82px;
            height: 82px;
            flex: 0 0 82px;
            object-fit: contain;
            border-radius: 12px;
            background: #fff;
          }
          .login-brand h1 {
            margin: 0;
            line-height: 1.2;
          }
          .login-brand .subtitle {
            margin-top: 6px;
            line-height: 1.4;
          }
          @media (max-width: 460px) {
            .login-brand {
              align-items: flex-start;
            }
            .login-brand img {
              width: 68px;
              height: 68px;
              flex-basis: 68px;
            }
          }
        `}</style>
      </form>
    </main>
  );
}
