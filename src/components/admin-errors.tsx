"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ErrorLogEntryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { ago, Banner, EmptyState, Loading } from "./ui";

/** /admin/errors: errores del servidor y del navegador (solo para los emails de `ADMIN_EMAILS`). */
export function AdminErrors() {
  const [list, setList] = useState<ErrorLogEntryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ErrorLogEntryDTO[]>("/api/admin/errors")
      .then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo cargar"));
  }, []);
  useEffect(load, [load]);

  const remove = (id?: number) =>
    void api(id === undefined ? "/api/admin/errors" : `/api/admin/errors/${id}`, {
      method: "DELETE",
    })
      .then(load)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo borrar"));

  return (
    <main className="page">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Administración</span>
          <h1 className="h1">Errores</h1>
          <p className="muted text-[13px]">
            Lo que ha fallado en el servidor y en los navegadores, agrupado. También:{" "}
            <Link href="/admin/reports">denuncias</Link>.
          </p>
        </div>
        {list && list.length > 0 && (
          <button type="button" className="btn" onClick={() => remove()}>
            Vaciar
          </button>
        )}
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!list && !error && <Loading>Cargando…</Loading>}
      {list && list.length === 0 && (
        <div className="panel">
          <EmptyState title="Ningún error registrado" />
        </div>
      )}
      {list && list.length > 0 && (
        <ul className="panel flex flex-col">
          {list.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 border-b border-line px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className={`pill ${e.source === "server" ? "pill-out" : "pill-warn"}`}>
                  {e.source === "server" ? "servidor" : "navegador"}
                </span>
                <b className="mono">×{e.count}</b>
                {e.path && <span className="mono subtle">{e.path}</span>}
                <span className="subtle">
                  último {ago(e.lastAt)} · primero {ago(e.firstAt)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost ml-auto"
                  onClick={() => remove(e.id)}
                >
                  Hecho
                </button>
              </div>
              <span className="text-[13.5px]">{e.message}</span>
              {(e.stack || e.userAgent) && (
                <details>
                  <summary className="subtle cursor-pointer text-xs">Detalles</summary>
                  {e.userAgent && <p className="subtle text-xs">{e.userAgent}</p>}
                  {e.stack && (
                    <pre className="mono overflow-x-auto text-[11.5px] whitespace-pre-wrap">
                      {e.stack}
                    </pre>
                  )}
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
