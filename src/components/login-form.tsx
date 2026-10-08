"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "./api-client";
import { Alert, buttonClass } from "./ui";

/** Solo rutas internas como destino (mismo criterio que safeNextPath en server/auth.ts). */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      window.location.assign(nextPath());
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "No se pudo entrar");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <button type="submit" disabled={busy || !password} className={buttonClass.primary}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
