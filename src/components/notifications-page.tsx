"use client";

import { useEffect, useState } from "react";
import { TRADE_TEXT, TRADE_TEXT_EN } from "@/domain/social/notification-text";
import { formatEuros } from "@/domain/suggestions/format";
import type { NotificationsResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { IconBell } from "./icons";
import { notifyNotificationsChanged } from "./local-collection";
import { Banner, EmptyState, Loading, ago } from "./ui";
import { Link, useLocale, useT } from "@/components/i18n";

/** /notifications: lo que han hecho las personas a las que sigues. Al abrirla, se marcan leídas. */
export function NotificationsPage() {
  const t = useT();
  const locale = useLocale();
  const en = locale === "en";
  const eur = (x: number) => formatEuros(x, locale);
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
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : t("Error al cargar", "Couldn't load")),
      );
  }, [t]);

  return (
    <main className="page">
      <h1 className="h1">{t("Notificaciones", "Notifications")}</h1>
      {error && <Banner tone="out">{error}</Banner>}
      {!data && !error && <Loading>{t("Cargando…", "Loading…")}</Loading>}
      {data && data.items.length === 0 && (
        <div className="panel">
          <EmptyState
            title={t("Nada por aquí", "Nothing here")}
            action={
              <Link className="btn btn-primary" href="/community">
                {t("Buscar a quien seguir", "Find people to follow")}
              </Link>
            }
          >
            {t(
              "Cuando alguien a quien sigues publique un mazo o añada una carta de más de 20 € a su colección, te aparecerá aquí.",
              "When someone you follow publishes a deck or adds a card worth over €20 to their collection, it'll show up here.",
            )}
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
                      {who}{" "}
                      {en
                        ? (TRADE_TEXT_EN[n.type] ?? "changed a trade proposal")
                        : (TRADE_TEXT[n.type] ?? "ha cambiado una propuesta de intercambio")}{" "}
                      ·{" "}
                      {n.tradeId ? (
                        <Link href={`/trades/proposals/${n.tradeId}`}>
                          {t("Ver la propuesta", "See the proposal")}
                        </Link>
                      ) : (
                        <Link href="/trades?tab=proposals">
                          {t("Ver propuestas", "See proposals")}
                        </Link>
                      )}
                    </>
                  ) : n.type === "group_join" ? (
                    <>
                      {who} {t("ha entrado en tu grupo", "joined your group")}{" "}
                      {n.refId ? (
                        <Link href={`/groups/${n.refId}`}>{n.title}</Link>
                      ) : (
                        <b>{n.title}</b>
                      )}
                    </>
                  ) : n.type === "game_recorded" ? (
                    <>
                      {who}{" "}
                      {t(
                        "ha registrado una partida en la que jugaste:",
                        "recorded a game you played in:",
                      )}{" "}
                      {n.title} ·{" "}
                      {n.refId && (
                        <Link href={`/games/${n.refId}`}>
                          {t("Ver la partida", "See the game")}
                        </Link>
                      )}
                    </>
                  ) : n.type === "deck_comment" ? (
                    <>
                      {who} {t("ha comentado en tu mazo", "commented on your deck")}{" "}
                      {n.deckId ? (
                        <Link href={`/decks/${n.deckId}#comments`}>{n.title}</Link>
                      ) : (
                        <b>{n.title}</b>
                      )}
                    </>
                  ) : n.type === "loan_new" ? (
                    <>
                      {who} {t("te ha prestado", "lent you")} <b>{n.title}</b> ·{" "}
                      <Link href="/loans">{t("Préstamos", "Loans")}</Link>
                    </>
                  ) : n.type === "new_deck" ? (
                    <>
                      {who} {t("ha publicado un mazo:", "published a deck:")}{" "}
                      {n.deckId ? <Link href={`/decks/${n.deckId}`}>{n.title}</Link> : n.title}
                    </>
                  ) : n.type === "trade_match" ? (
                    <>
                      {who} {t("tiene libre", "has a free")} <b>{n.title}</b>
                      {t(", que está en tu lista de deseos", ", which is on your wishlist")} ·{" "}
                      <Link href="/trades">{t("Ver cruces", "See matches")}</Link>
                    </>
                  ) : n.type === "price_drop" ? (
                    <>
                      {t("Ha bajado", "Price drop:")} <b>{n.title}</b>
                      {t(", que te falta", ", which you're missing")}
                      {n.deckId && (
                        <>
                          {" "}
                          {t("para", "for")}{" "}
                          <Link href={`/decks/${n.deckId}?tab=missing`}>
                            {t("uno de tus mazos", "one of your decks")}
                          </Link>
                        </>
                      )}
                      {n.price !== null && (
                        <span className="mono subtle">
                          {" "}
                          · {n.prevPrice !== null && <>{eur(n.prevPrice)} → </>}
                          {eur(n.price)}
                          {n.prevPrice !== null &&
                            n.prevPrice > 0 &&
                            ` (−${Math.round(((n.prevPrice - n.price) / n.prevPrice) * 100)}${en ? "" : " "}%)`}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {who} {t("ha añadido", "added")} <b>{n.title}</b>{" "}
                      {t("a su colección", "to their collection")}
                      {n.price !== null && <span className="mono subtle"> · {eur(n.price)}</span>}
                    </>
                  )}
                </span>
                <span className="mono subtle text-xs whitespace-nowrap">
                  {ago(n.createdAt, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
