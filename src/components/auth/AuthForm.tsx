"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";

type Mode = "admin-login" | "client-login" | "client-register";

export function AuthForm({
  mode,
  nextPath,
  title,
  subtitle,
  configurationError,
}: {
  mode: Mode;
  nextPath: string;
  title: string;
  subtitle: string;
  configurationError?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "client-register";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { name, phone, email, password }
        : { email, password, intent: mode === "admin-login" ? "admin" : "client" };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-head">
          <span className="auth-icon">{isRegister ? <UserPlus size={22} /> : <LogIn size={22} />}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {configurationError ? <p className="auth-error">{configurationError}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        {isRegister ? (
          <>
            <label className="auth-field">
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
            <label className="auth-field">
              Phone (optional)
              <input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            </label>
          </>
        ) : null}

        <label className="auth-field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
          />
        </label>

        <button className="auth-submit" type="submit" disabled={busy || Boolean(configurationError)}>
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>

        {mode === "client-login" ? (
          <p className="auth-switch">
            New here? <a href={`/account/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>Create an account</a>
          </p>
        ) : null}
        {mode === "client-register" ? (
          <p className="auth-switch">
            Already have an account? <a href={`/account/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>Sign in</a>
          </p>
        ) : null}
      </form>
    </div>
  );
}
