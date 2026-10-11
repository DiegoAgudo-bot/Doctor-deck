"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/domain/social/comments";
import type { ReportedCommentDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { MemberLink } from "./games-ui";
import { ago, Banner, EmptyState, Loading } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** /admin/reports: comentarios denunciados (solo para los emails de `ADMIN_EMAILS`). */
export function AdminReports() {
  const [list, setList] = useState<ReportedCommentDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ReportedCommentDTO[]>("/api/admin/reports")
      .then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo cargar"));
  }, []);
  useEffect(load, [load]);

  const act = (c: ReportedCommentDTO, action: "keep" | "hide" | "delete") =>
    void api(`/api/admin/reports/${c.id}`, { method: "PATCH", ...json({ action }) })
      .then(load)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo guardar"));

  return (
    <main className="page max-w-[860px]">
      <h1 className="h1">Denuncias</h1>
      {error && <Banner tone="out">{error}</Banner>}
      {!list && !error && <Loading>Cargando…</Loading>}
      {list && list.length === 0 && (
        <div className="panel">
          <EmptyState title="No hay nada pendiente" />
        </div>
      )}
      {list && list.length > 0 && (
        <ul className="panel comments">
          {list.map((c) => (
            <li key={c.id} className="flex-col">
              <div className="flex w-full flex-wrap items-center gap-2 text-[12.5px]">
                <b>
                  <MemberLink m={c.author} />
                </b>
                <span className="subtle">
                  en <Link href={`/decks/${c.deck.id}#comments`}>{c.deck.name}</Link> ·{" "}
                  {ago(c.createdAt)}
                </span>
                <span className="pill pill-out">{c.reports} denuncias</span>
                {(Object.entries(c.reasons) as [ReportReason, number][]).map(([r, n]) => (
                  <span key={r} className="pill">
                    {REPORT_REASONS[r]} ×{n}
                  </span>
                ))}
                {c.hidden && <span className="pill pill-warn">Oculto</span>}
              </div>
              <p className="comment-body w-full">{c.body}</p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm" onClick={() => act(c, "keep")}>
                  Está bien: dejarlo
                </button>
                <button type="button" className="btn btn-sm" onClick={() => act(c, "hide")}>
                  Ocultarlo
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-out"
                  onClick={() => act(c, "delete")}
                >
                  Borrarlo
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
