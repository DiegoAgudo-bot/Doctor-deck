"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CommunityDeckDTO, UserSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { DeckTile } from "./deck-tile";
import { Banner, EmptyState, Loading, fmt } from "./ui";

/** /comunidad: buscar gente y los últimos mazos públicos. */
export function CommunityPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserSummaryDTO[] | null>(null);
  const [decks, setDecks] = useState<CommunityDeckDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<CommunityDeckDTO[]>("/api/community/decks")
      .then(setDecks)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Error al cargar"));
  }, []);

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
      {error && <Banner tone="out">{error}</Banner>}

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

      <section className="flex flex-col gap-3">
        <h2 className="h2" style={{ fontSize: 17 }}>
          Mazos recientes
        </h2>
        {decks === null ? (
          <Loading>Cargando mazos…</Loading>
        ) : decks.length === 0 ? (
          <div className="panel">
            <EmptyState title="Aún no hay mazos públicos">
              Guarda uno de los tuyos y será el primero.
            </EmptyState>
          </div>
        ) : (
          <div
            className="grid-1-sm grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {decks.map((d, i) => (
              <DeckTile key={d.id} deck={d} owner={d.owner} delay={i * 30} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
