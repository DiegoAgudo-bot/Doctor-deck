"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { UserSummaryDTO } from "@/server/dto";
import { api } from "./api-client";
import { CommunityDecks } from "./community-decks";
import { Loading, fmt } from "./ui";

/** /comunidad: buscar gente y mazos públicos (con cuánto tienes de cada uno). */
export function CommunityPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserSummaryDTO[] | null>(null);

  // Buscar con un respiro mientras se escribe; sin texto, los más activos.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(
      () => {
        api<UserSummaryDTO[]>(`/api/users?q=${encodeURIComponent(q.trim())}`)
          .then((u) => !cancelled && setUsers(u))
          .catch(() => !cancelled && setUsers([]));
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <main className="page max-w-[1100px]" style={{ gap: 20 }}>
      <div className="flex flex-col gap-1">
        <h1 className="h1">Comunidad</h1>
        <p className="muted text-[13px]">
          Mira los mazos de otros jugadores, sigue a quien te interese y te avisaremos cuando
          publiquen un mazo o consigan una carta gorda.
        </p>
      </div>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Jugadores</span>
        </div>
        <div className="flex flex-col gap-3 p-3">
          <input
            className="input"
            style={{ maxWidth: 360 }}
            placeholder="Buscar por nombre o @usuario…"
            aria-label="Buscar jugadores"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {users === null ? (
            <Loading>Buscando…</Loading>
          ) : users.length === 0 ? (
            <p className="muted text-[13px]">
              {q ? `Nadie con «${q}».` : "Todavía no hay nadie con perfil."}
            </p>
          ) : (
            <div
              className="grid-1-sm grid gap-2"
              style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
              {users.map((u) => (
                <Link
                  key={u.username}
                  href={`/u/${u.username}`}
                  className="deckrow"
                  style={{ gridTemplateColumns: "36px minmax(0, 1fr)", padding: 8 }}
                >
                  <span className="avatar" style={{ width: 36, height: 36, fontSize: 15 }}>
                    {(u.name.trim()[0] ?? u.username[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="nm" style={{ color: "var(--color-text)", fontWeight: 600 }}>
                      {u.name}
                    </span>
                    <span className="cmd">
                      @{u.username} · {fmt(u.publicDecks)} mazos · {fmt(u.followers)} seguidores
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <CommunityDecks />
    </main>
  );
}
