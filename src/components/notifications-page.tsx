"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { NotificationsResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { IconBell } from "./icons";
import { notifyNotificationsChanged } from "./local-collection";
import { Banner, EmptyState, Loading, ago } from "./ui";

/** /notificaciones: lo que han hecho las personas a las que sigues. Al abrirla, se marcan leídas. */
export function NotificationsPage() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<NotificationsResponse>("/api/notifications")
      .then(async (d) => {
        setData(d);
        if (d.unread > 0) {
          await api("/api/notifications/read", { method: "POST" });
          notifyNotificationsChanged();
        }
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Error al cargar"));
  }, []);

  return (
    <main className="page max-w-[760px]">
      <h1 className="h1">Notificaciones</h1>
      {error && <Banner tone="out">{error}</Banner>}
      {!data && !error && <Loading>Cargando…</Loading>}
      {data && data.items.length === 0 && (
        <div className="panel">
          <EmptyState
            title="Nada por aquí"
            action={
              <Link className="btn btn-primary" href="/comunidad">
                Buscar a quien seguir
              </Link>
            }
          >
            Cuando alguien a quien sigues publique un mazo o añada una carta de más de 20 € a su
            colección, te aparecerá aquí.
          </EmptyState>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="panel m-0 flex list-none flex-col p-0">
          {data.items.map((n) => {
            const who = n.actor.username ? (
              <Link href={`/u/${n.actor.username}`} style={{ fontWeight: 600 }}>
                @{n.actor.username}
              </Link>
            ) : (
              <b>{n.actor.name}</b>
            );
            return (
              <li
                key={n.id}
                className="flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0"
                style={{ background: n.read ? undefined : "var(--color-raised)" }}
              >
                <span className="mt-0.5" style={{ color: "var(--color-accent)" }}>
                  <IconBell size={15} />
                </span>
                <span className="flex-1 text-[13.5px]">
                  {n.type === "new_deck" ? (
                    <>
                      {who} ha publicado un mazo:{" "}
                      {n.deckId ? <Link href={`/decks/${n.deckId}`}>{n.title}</Link> : n.title}
                    </>
                  ) : n.type === "price_drop" ? (
                    <>
                      Ha bajado <b>{n.title}</b>, que te falta
                      {n.deckId && (
                        <>
                          {" "}
                          para <Link href={`/decks/${n.deckId}?tab=falta`}>uno de tus mazos</Link>
                        </>
                      )}
                      {n.price !== null && (
                        <span className="mono subtle">
                          {" "}
                          · {n.prevPrice !== null && <>{formatEuros(n.prevPrice)} → </>}
                          {formatEuros(n.price)}
                          {n.prevPrice !== null &&
                            n.prevPrice > 0 &&
                            ` (−${Math.round(((n.prevPrice - n.price) / n.prevPrice) * 100)} %)`}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {who} ha añadido <b>{n.title}</b> a su colección
                      {n.price !== null && (
                        <span className="mono subtle"> · {formatEuros(n.price)}</span>
                      )}
                    </>
                  )}
                </span>
                <span className="mono subtle text-xs whitespace-nowrap">{ago(n.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
