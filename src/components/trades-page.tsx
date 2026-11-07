"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type {
  CardDTO,
  MyProfileDTO,
  MyTradesDTO,
  TradeCardDTO,
  TradePartnerDTO,
  TradeProposalSummaryDTO,
} from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover } from "./card-image";
import { CardSearch } from "./card-search";
import { IconX } from "./icons";
import { statusLabel } from "./trade-proposal-pages";
import { Banner, EmptyState, Loading, ago, fmt } from "./ui";
import { Link, useLocale, useT } from "@/components/i18n";

type Tab = "matches" | "proposals" | "wanted" | "offered";
const TABS: readonly Tab[] = ["matches", "proposals", "wanted", "offered"];

/** Lista compacta de cartas con copias y precio. */
export function TradeCardList({
  items,
  empty,
  action,
}: {
  items: TradeCardDTO[];
  empty: string;
  action?: (item: TradeCardDTO) => React.ReactNode;
}) {
  const locale = useLocale();
  if (items.length === 0) return <p className="subtle text-[13px]">{empty}</p>;
  return (
    <ul className="flex flex-col" style={{ listStyle: "none" }}>
      {items.map((i) => (
        <li
          key={i.card.oracleId}
          className="flex items-center gap-2 border-b border-line py-1.5 text-[13.5px] last:border-b-0"
        >
          <span className="mono subtle" style={{ width: 24 }}>
            {i.quantity}
          </span>
          <CardHover card={i.card} className="min-w-0 flex-1 truncate">
            {i.card.name}
          </CardHover>
          <span className="mono subtle whitespace-nowrap">
            {i.price !== null ? formatEuros(i.price * i.quantity, locale) : "—"}
          </span>
          {action?.(i)}
        </li>
      ))}
    </ul>
  );
}

/** Un jugador con el que cruzo: lo que tiene que quiero y lo que quiere que tengo. */
export function PartnerCard({ p }: { p: TradePartnerDTO }) {
  const t = useT();
  const locale = useLocale();
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="flex items-center gap-2">
          <Link className="h2" href={`/u/${p.profile.username}`}>
            @{p.profile.username}
          </Link>
          {p.following && <span className="pill subtle">{t("le sigues", "following")}</span>}
        </span>
        <span className="flex items-center gap-3">
          <span className="subtle text-xs">{p.profile.name}</span>
          <Link className="btn btn-sm btn-primary" href={`/trades/with/${p.profile.username}`}>
            {t("Proponer intercambio", "Propose a trade")}
          </Link>
        </span>
      </div>
      <div
        className="grid-1-sm grid gap-4 p-3.5"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <div className="flex flex-col gap-2">
          <span className="cap">
            {t("Tiene lo que buscas", "Has what you want")}
            {p.haveValue > 0 && (
              <span className="mono"> · ≈ {formatEuros(p.haveValue, locale)}</span>
            )}
          </span>
          <TradeCardList
            items={p.theyHave}
            empty={t("Nada de tu lista de deseos.", "Nothing from your wishlist.")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="cap">
            {t("Busca lo que te sobra", "Wants what you can spare")}
            {p.wantValue > 0 && (
              <span className="mono"> · ≈ {formatEuros(p.wantValue, locale)}</span>
            )}
          </span>
          <TradeCardList
            items={p.theyWant}
            empty={t("Nada de lo que tienes para cambiar.", "Nothing you have for trade.")}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * /trades: con quién cruzo (quién tiene lo que busco y busca lo que me sobra), mi lista de
 * deseos (a mano y lo que falta de los mazos que elija) y mis cartas para cambiar (copias libres).
 * Sin pagos ni mensajes: cada uno se contacta por fuera.
 */
export function TradesPage() {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("matches");
  const [mine, setMine] = useState<MyTradesDTO | null>(null);
  const [partners, setPartners] = useState<TradePartnerDTO[] | null>(null);
  const [proposals, setProposals] = useState<TradeProposalSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p, props] = await Promise.all([
        api<MyTradesDTO>("/api/trades"),
        api<TradePartnerDTO[]>("/api/trades/matches"),
        api<TradeProposalSummaryDTO[]>("/api/trades/proposals"),
      ]);
      setMine(m);
      setPartners(p);
      setProposals(props);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudieron cargar tus listas", "Couldn't load your lists"),
      );
    }
  }, [t]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
    // ?tab=proposals (al volver de una propuesta o desde un aviso).
    const raw = new URLSearchParams(window.location.search).get("tab");
    // Enlaces antiguos: ?tab=propuestas.
    const wanted = raw === "propuestas" ? "proposals" : raw;
    const found = TABS.find((x) => x === wanted);
    if (found) setTab(found);
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("No se pudo guardar", "Couldn't save"));
    } finally {
      setBusy(false);
    }
  }
  const put = (path: string, body: unknown) =>
    api(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const setWish = (card: CardDTO, quantity: number) =>
    run(() => put(`/api/trades/wishes/${encodeURIComponent(card.oracleId)}`, { quantity }));
  const setKeep = (card: CardDTO, keep: boolean) =>
    run(() => put(`/api/trades/keeps/${encodeURIComponent(card.oracleId)}`, { keep }));
  const setDeck = (id: string, inWishlist: boolean) =>
    run(() =>
      api(`/api/decks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inWishlist }),
      }),
    );
  const setPublic = (value: boolean) =>
    run(() =>
      api<MyProfileDTO>("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradesPublic: value }),
      }),
    );

  if (!mine || !partners || !proposals) {
    return (
      <main className="page">
        <h1 className="h1">{t("Intercambios", "Trades")}</h1>
        {error ? (
          <Banner tone="out">{error}</Banner>
        ) : (
          <Loading>{t("Cargando tus listas…", "Loading your lists…")}</Loading>
        )}
      </main>
    );
  }

  const wishValue = mine.wishlist.reduce((n, w) => n + (w.price ?? 0) * w.quantity, 0);
  return (
    <main className="page" style={{ gap: 20 }}>
      <div className="flex flex-col gap-1">
        <h1 className="h1">{t("Intercambios", "Trades")}</h1>
        <p className="muted text-[13px]">
          {t(
            "Tu lista de deseos y tus cartas para cambiar, y quién de la comunidad tiene lo que buscas o busca lo que te sobra. Aquí no se paga ni se envía nada: habla con esa persona por fuera.",
            "Your wishlist and your cards for trade, and who in the community has what you want or wants what you can spare. Nothing is paid or shipped here: talk to that person outside the site.",
          )}
        </p>
      </div>
      {error && <Banner tone="out">{error}</Banner>}

      {mine.public ? (
        <p className="subtle text-[13px]">
          {t(
            "Tus listas son públicas: salen en tu perfil y en los cruces de otros jugadores.",
            "Your lists are public: they show on your profile and in other players' matches.",
          )}{" "}
          <button
            type="button"
            className="linkbtn underline"
            disabled={busy}
            onClick={() => void setPublic(false)}
          >
            {t("Hacerlas privadas", "Make them private")}
          </button>
        </p>
      ) : (
        <Banner
          tone="info"
          action={
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => void setPublic(true)}
            >
              {t("Hacerlas públicas", "Make them public")}
            </button>
          }
        >
          <b>{t("Tus listas son privadas.", "Your lists are private.")}</b>{" "}
          <span className="muted">
            {t(
              "Hazlas públicas para cruzarlas con las de otros jugadores (y que ellos te encuentren).",
              "Make them public to match them with other players' lists (and so they can find you).",
            )}
          </span>
        </Banner>
      )}

      <nav className="tabs" aria-label={t("Secciones de intercambios", "Trade sections")}>
        {(
          [
            ["matches", t("Cruces", "Matches"), partners.length],
            ["proposals", t("Propuestas", "Proposals"), proposals.filter((x) => x.myTurn).length],
            ["wanted", t("Lo que busco", "Wanted"), mine.wishlist.length],
            ["offered", t("Para cambiar", "For trade"), mine.tradelistTotal],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            <span className="n">{fmt(n, locale)}</span>
          </button>
        ))}
      </nav>

      {tab === "matches" &&
        (partners.length === 0 ? (
          <div className="panel">
            <EmptyState title={t("Todavía no hay cruces", "No matches yet")}>
              {mine.wishlist.length === 0
                ? t(
                    "Añade cartas a tu lista de deseos (o mete un mazo en ella) para ver quién las tiene.",
                    "Add cards to your wishlist (or put a deck in it) to see who has them.",
                  )
                : t(
                    "Nadie con listas públicas tiene libre lo que buscas ni busca lo que te sobra. Prueba más adelante.",
                    "Nobody with public lists has what you want free or wants what you can spare. Try again later.",
                  )}
            </EmptyState>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {partners.map((p) => (
              <PartnerCard key={p.profile.username} p={p} />
            ))}
          </div>
        ))}

      {tab === "proposals" && <ProposalList items={proposals} />}

      {tab === "wanted" && (
        <div
          className="grid-1-sm grid items-start gap-4"
          style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}
        >
          <section className="panel">
            <div className="panel-h">
              <span className="h2">{t("Lo que busco", "Wanted")}</span>
              {wishValue > 0 && (
                <span className="mono subtle text-xs">≈ {formatEuros(wishValue, locale)}</span>
              )}
            </div>
            <div className="flex flex-col gap-3 p-3.5">
              <div style={{ maxWidth: 380 }}>
                <CardSearch
                  id="wish-search"
                  label={t("Añadir una carta", "Add a card")}
                  clearOnPick
                  onPick={(card) =>
                    void setWish(
                      card,
                      (mine.wishlist.find((w) => w.card.oracleId === card.oracleId)?.manual ?? 0) +
                        1,
                    )
                  }
                />
              </div>
              <TradeCardList
                items={mine.wishlist}
                empty={t("Tu lista de deseos está vacía.", "Your wishlist is empty.")}
                action={(i) => {
                  const w = mine.wishlist.find((x) => x.card.oracleId === i.card.oracleId);
                  return w && w.manual > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ width: 26, height: 26 }}
                      disabled={busy}
                      aria-label={t(
                        `Quitar ${i.card.name} de la lista`,
                        `Remove ${i.card.name} from the list`,
                      )}
                      title={
                        w.forDecks > 0
                          ? t(
                              "Quitar lo añadido a mano (sigue por tus mazos)",
                              "Remove what you added by hand (it stays for your decks)",
                            )
                          : t("Quitar", "Remove")
                      }
                      onClick={() => void setWish(i.card, 0)}
                    >
                      <IconX size={12} />
                    </button>
                  ) : (
                    <span
                      className="pill subtle"
                      title={t(
                        "Te falta para un mazo de tu lista de deseos",
                        "You need it for a deck on your wishlist",
                      )}
                    >
                      {t("mazo", "deck")}
                    </span>
                  );
                }}
              />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h">
              <span className="h2">{t("Mazos en la lista", "Decks on the list")}</span>
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              <p className="subtle text-xs">
                {t(
                  "Lo que te falta para los mazos marcados entra solo en tu lista de deseos (contando lo que ya usan tus otros mazos).",
                  "What you're missing for the checked decks goes on your wishlist automatically (counting what your other decks already use).",
                )}
              </p>
              {mine.decks.length === 0 ? (
                <p className="subtle text-[13px]">
                  {t("No tienes mazos guardados.", "You have no saved decks.")}{" "}
                  <Link href="/decks/new">{t("Crea uno", "Create one")}</Link>.
                </p>
              ) : (
                mine.decks.map((d) => (
                  <label key={d.id} className="check text-[13.5px]">
                    <input
                      type="checkbox"
                      checked={d.inWishlist}
                      disabled={busy}
                      onChange={(e) => void setDeck(d.id, e.target.checked)}
                    />
                    <span className="min-w-0">
                      {d.name}
                      <span className="subtle block truncate text-xs">
                        {d.commanderNames.join(" + ")}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "offered" && (
        <div
          className="grid-1-sm grid items-start gap-4"
          style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}
        >
          <section className="panel">
            <div className="panel-h">
              <span className="h2">{t("Para cambiar", "For trade")}</span>
              <span className="subtle text-xs">
                {mine.tradelistTotal > mine.tradelist.length
                  ? t(
                      `Las ${mine.tradelist.length} de más valor de ${fmt(mine.tradelistTotal)}`,
                      `The ${mine.tradelist.length} most valuable of ${fmt(mine.tradelistTotal, locale)}`,
                    )
                  : t("Tus copias libres", "Your free copies")}
              </span>
            </div>
            <div className="p-3.5">
              <TradeCardList
                items={mine.tradelist}
                empty={t(
                  "No tienes copias libres: todo lo que tienes está en tus mazos (o no has importado tu colección).",
                  "You have no free copies: everything you own is in your decks (or you haven't imported your collection).",
                )}
                action={(i) => (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    title={t(
                      "No la cambio: sale de esta lista",
                      "Not for trade: removes it from this list",
                    )}
                    onClick={() => void setKeep(i.card, true)}
                  >
                    {t("No la cambio", "Keep it")}
                  </button>
                )}
              />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h">
              <span className="h2">{t("No las cambio", "Not for trade")}</span>
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              <p className="subtle text-xs">
                {t(
                  "Para cambiar salen solas tus copias libres (las que no usa ningún mazo), sin tierras básicas. Las que marques aquí no salen.",
                  "Your free copies (those no deck uses), without basic lands, are listed for trade automatically. The ones you mark here aren't.",
                )}
              </p>
              {mine.keep.length === 0 ? (
                <p className="subtle text-[13px]">{t("Ninguna.", "None.")}</p>
              ) : (
                <ul className="flex flex-col" style={{ listStyle: "none" }}>
                  {mine.keep.map((c) => (
                    <li key={c.oracleId} className="flex items-center gap-2 py-1 text-[13.5px]">
                      <CardHover card={c} className="min-w-0 flex-1 truncate">
                        {c.name}
                      </CardHover>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => void setKeep(c, false)}
                      >
                        {t("Sí la cambio", "Trade it")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

/** Mis propuestas de intercambio: primero las que me toca responder. */
function ProposalList({ items }: { items: TradeProposalSummaryDTO[] }) {
  const t = useT();
  const locale = useLocale();
  if (items.length === 0) {
    return (
      <div className="panel">
        <EmptyState title={t("Ninguna propuesta", "No proposals")}>
          {t(
            "Desde un cruce o desde el perfil de alguien con listas públicas, pulsa «Proponer intercambio»: la calculadora te propone qué cambiar, cuadrado por valor.",
            "From a match or from the profile of someone with public lists, press “Propose a trade”: the calculator suggests what to swap, balanced by value.",
          )}
        </EmptyState>
      </div>
    );
  }
  const sorted = [...items].sort((a, b) => Number(b.myTurn) - Number(a.myTurn));
  return (
    <ul className="panel m-0 flex list-none flex-col p-0">
      {sorted.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5 text-[13.5px] last:border-b-0"
        >
          <Link href={`/trades/proposals/${p.id}`} style={{ fontWeight: 600 }}>
            @{p.partner.username}
          </Link>
          <span
            className={`pill ${p.status === "accepted" ? "pill-in" : p.myTurn ? "pill-warn" : ""}`}
          >
            {p.myTurn ? t("Te toca", "Your turn") : statusLabel(p.status, t)}
          </span>
          <span className="muted">
            {t("das", "you give")} {p.giveCount} · {t("recibes", "you get")} {p.getCount}
          </span>
          <span className="mono subtle">
            {formatEuros(p.balance.giveValue, locale)} ↔ {formatEuros(p.balance.getValue, locale)}
          </span>
          <span className="subtle ml-auto text-xs">
            {p.isMine ? t("enviada por ti", "sent by you") : t("recibida", "received")} ·{" "}
            {ago(p.updatedAt, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
