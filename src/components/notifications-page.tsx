"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRADE_TEXT } from "@/domain/social/notification-text";
import { formatEuros } from "@/domain/suggestions/format";
import type { NotificationsResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { IconBell } from "./icons";
import { notifyNotificationsChanged } from "./local-collection";
import { Banner, EmptyState, Loading, ago } from "./ui";

/** /notifications: lo que han hecho las personas a las que sigues. Al abrirla, se marcan leídas. */
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
    <main className="page">
      <h1 className="h1">Notificaciones</h1>
      {error && <Banner tone="out">{error}</Banner>}
      {!data && !error && <Loading>Cargando…</Loading>}
      {data && data.items.length === 0 && (
        <div className="panel">
          <EmptyState
            title="Nada por aquí"
            action={
              <Link className="btn btn-primary" href="/community">
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
                  {n.type.startsWith("trade_") && n.type !== "trade_match" ? (
                    <>
                      {who} {TRADE_TEXT[n.type] ?? "ha cambiado una propuesta de intercambio"} ·{" "}
                      {n.tradeId ? (
                        <Link href={`/trades/proposals/${n.tradeId}`}>Ver la propuesta</Link>
                      ) : (
                        <Link href="/trades?tab=proposals">Ver propuestas</Link>
                      )}
                    </>
                  ) : n.type === "group_join" ? (
                    <>
                      {who} ha entrado en tu grupo{" "}
                      {n.refId ? (
                        <Link href={`/groups/${n.refId}`}>{n.title}</Link>
                      ) : (
                        <b>{n.title}</b>
                      )}
                    </>
                  ) : n.type === "game_recorded" ? (
                    <>
                      {who} ha registrado una partida en la que jugaste: {n.title} ·{" "}
                      {n.refId && <Link href={`/games/${n.refId}`}>Ver la partida</Link>}
                    </>
                  ) : n.type === "deck_comment" ? (
                    <>
                      {who} ha comentado en tu mazo{" "}
                      {n.deckId ? (
                        <Link href={`/decks/${n.deckId}#comments`}>{n.title}</Link>
                      ) : (
                        <b>{n.title}</b>
                      )}
                    </>
                  ) : n.type === "loan_new" ? (
                    <>
                      {who} te ha prestado <b>{n.title}</b> · <Link href="/loans">Préstamos</Link>
                    </>
                  ) : n.type === "new_deck" ? (
                    <>
                      {who} ha publicado un mazo:{" "}
                      {n.deckId ? <Link href={`/decks/${n.deckId}`}>{n.title}</Link> : n.title}
                    </>
                  ) : n.type === "trade_match" ? (
                    <>
                      {who} tiene libre <b>{n.title}</b>, que está en tu lista de deseos ·{" "}
                      <Link href="/trades">Ver cruces</Link>
                    </>
                  ) : n.type === "price_drop" ? (
                    <>
                      Ha bajado <b>{n.title}</b>, que te falta
                      {n.deckId && (
                        <>
                          {" "}
                          para <Link href={`/decks/${n.deckId}?tab=missing`}>uno de tus mazos</Link>
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
