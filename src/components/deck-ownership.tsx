"use client";

import { useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, OwnershipDTO, OwnershipItemDTO } from "@/server/dto";
import { CardHover } from "./card-image";
import { CardPriceDialog } from "./card-price-dialog";
import { ManaCost } from "./mana";
import { api, ApiError } from "./api-client";
import { Banner, Dialog, fmt } from "./ui";
import { Link, useLocale, useT } from "@/components/i18n";
import type { Locale } from "@/domain/i18n/locale";

const cardmarketUrl = (name: string, locale: Locale) =>
  `https://www.cardmarket.com/${locale}/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

/** Lista de compra en el formato "1 Nombre" que admiten Cardmarket (Wants) y casi todas las webs. */
export function shoppingList(items: readonly OwnershipItemDTO[]): string {
  return items
    .filter((i) => i.toBuy > 0)
    .map((i) => `${i.toBuy} ${i.card.name.split(" // ")[0] ?? i.card.name}`)
    .join("\n");
}

/** Una línea para `POST /api/collection/cards`: la edición del mazo si se sabe, si no la carta. */
export interface CollectionCardInput {
  oracleId?: string;
  scryfallId?: string;
  quantity: number;
  foil?: boolean;
}

/** Lo que pide `POST /api/collection/cards` para una carta del mazo (con su edición y foil). */
export function collectionInput(card: CardDTO, quantity: number): CollectionCardInput {
  return {
    quantity,
    ...(card.printing ? { scryfallId: card.printing.scryfallId } : { oracleId: card.oracleId }),
    ...(card.foil ? { foil: true } : {}),
  };
}

/**
 * «Tengo este mazo en físico» (p. ej. un precon): añade a la colección todas sus cartas o solo
 * las que faltan, como cartas sueltas (reimportar el CSV no las borra).
 */
function DeckToCollection({ all, missing, onDone }: DeckToCollectionProps) {
  const t = useT();
  const locale = useLocale();
  const [ask, setAsk] = useState<"all" | "missing" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "in" | "out"; text: string } | null>(null);
  const copies = (xs: readonly CollectionCardInput[]) => xs.reduce((n, x) => n + x.quantity, 0);
  const n = { all: copies(all), missing: copies(missing) };

  async function add(which: "all" | "missing") {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/collection/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: which === "all" ? all : missing }),
      });
      setMsg({
        tone: "in",
        text: t(
          `Añadidas ${fmt(n[which], locale)} copias a tu colección.`,
          `Added ${fmt(n[which], locale)} copies to your collection.`,
        ),
      });
      setAsk(null);
      onDone();
    } catch (e) {
      setMsg({
        tone: "out",
        text:
          e instanceof ApiError
            ? e.message
            : t("No se pudieron añadir las cartas", "Couldn't add the cards"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-h stack-sm py-2">
        <span className="h2">{t("¿Tienes el mazo en físico?", "Own this deck in paper?")}</span>
        <div className="flex flex-wrap gap-2">
          {ask ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
                {t("Cancelar", "Cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void add(ask)}
              >
                {busy
                  ? t("Añadiendo…", "Adding…")
                  : t(`Añadir ${fmt(n[ask], locale)} copias`, `Add ${fmt(n[ask], locale)} copies`)}
              </button>
            </>
          ) : (
            <>
              {n.missing > 0 && n.missing < n.all && (
                <button type="button" className="btn" onClick={() => setAsk("missing")}>
                  {t(
                    `Añadir lo que me falta (${fmt(n.missing, locale)})`,
                    `Add what I'm missing (${fmt(n.missing, locale)})`,
                  )}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setAsk("all")}>
                {t(
                  `Añadir todo a mi colección (${fmt(n.all, locale)})`,
                  `Add it all to my collection (${fmt(n.all, locale)})`,
                )}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="px-4 pb-3.5">
        {msg ? (
          <Banner tone={msg.tone}>{msg.text}</Banner>
        ) : (
          <span className="hint">
            {ask === "all"
              ? t(
                  "Se suman todas las cartas del mazo (con su edición), también las que ya tienes: es para cuando compras el mazo entero, como un precon.",
                  "Every card in the deck is added (with its printing), even the ones you already have: it's for when you buy the whole deck, like a precon.",
                )
              : t(
                  "Vuelca las cartas del mazo a tu colección con su edición. Luego puedes editarlas o borrarlas en la colección.",
                  "Adds the deck's cards to your collection with their printing. You can edit or delete them later in the collection.",
                )}
          </span>
        )}
      </div>
    </section>
  );
}

interface DeckToCollectionProps {
  all: readonly CollectionCardInput[];
  missing: readonly CollectionCardInput[];
  /** Tras añadirlas (p. ej. volver a analizar para que cambie lo que falta). */
  onDone: () => void;
}

function Stat({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string | undefined;
  tone?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5">
      <span className="cap">{label}</span>
      <span className="mono" style={{ fontSize: 22, fontWeight: 500, color: tone }}>
        {value}
      </span>
      {meta && <span className="subtle text-xs">{meta}</span>}
    </div>
  );
}

function CardName({ item }: { item: OwnershipItemDTO }) {
  const t = useT();
  return (
    <CardHover card={item.card} className="inline-flex items-center gap-2">
      {item.card.name}
      {item.isCommander && <span className="pill subtle">{t("comandante", "commander")}</span>}
      <ManaCost cost={item.card.manaCost} />
    </CardHover>
  );
}

/** "Deck A, Deck B, Prestada a @ana", con enlace a cada mazo. */
export function UsedIn({ item }: { item: Pick<OwnershipItemDTO, "usedIn" | "usedInDecks"> }) {
  const linked = new Map(item.usedInDecks.map((d) => [d.name, d.id]));
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span className="dot dot-inuse" />
      {item.usedIn.map((name, i) => {
        const id = linked.get(name);
        return (
          <span key={`${name}-${i}`}>
            {id ? <Link href={`/decks/${id}`}>{name}</Link> : name}
            {i < item.usedIn.length - 1 && ","}
          </span>
        );
      })}
    </span>
  );
}

/** Las cartas del mazo que tengo pero están en otros mazos (o prestadas), y dónde. */
export function OtherDecksDialog({
  items,
  onClose,
}: {
  items: readonly OwnershipItemDTO[];
  onClose: () => void;
}) {
  const t = useT();
  const elsewhere = items.filter((i) => i.fromOtherDecks > 0);
  return (
    <Dialog open onClose={onClose} title={t("En otros mazos", "In other decks")} width={560}>
      <p className="muted text-[13px]">
        {t(
          "Las tienes, pero las estás usando en otros mazos: muévelas o compra otra copia.",
          "You own them, but they're in other decks: move them or buy another copy.",
        )}
      </p>
      <div className="flex flex-col">
        {elsewhere.map((i) => (
          <div key={i.card.oracleId} className="kv" style={{ alignItems: "center" }}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="mono subtle">{i.fromOtherDecks}</span>
              <CardHover card={i.card} className="truncate">
                {i.card.name}
              </CardHover>
            </span>
            <span className="text-right text-[12.5px]">
              <UsedIn item={i} />
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * Pestaña "Qué me falta": el mazo frente a mi colección. Lo que tengo, lo que tendría que sacar de
 * otros mazos y lo que me falta comprar (con precio, lista para Cardmarket y enlaces).
 */
export function OwnershipPanel({
  ownership,
  hasCollection,
  loggedIn,
  wishlist,
  toCollection,
}: {
  ownership: OwnershipDTO;
  hasCollection: boolean;
  loggedIn: boolean;
  /** Con sesión: añadir las cartas del mazo a mi colección. */
  toCollection?: DeckToCollectionProps | undefined;
  /** En mis mazos guardados: si lo que falta entra en mi lista de deseos, y cambiarlo. */
  wishlist?: { on: boolean; busy: boolean; onToggle: () => void } | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const eur = (x: number) => formatEuros(x, locale);
  const [copied, setCopied] = useState(false);
  const [priceCard, setPriceCard] = useState<CardDTO | null>(null);
  const { items, totals } = ownership;
  const missing = items
    .filter((i) => i.status === "missing")
    .sort((a, b) => (b.price ?? -1) * b.toBuy - (a.price ?? -1) * a.toBuy);
  const elsewhere = items.filter((i) => i.status === "in_other_decks");
  const have = items.filter((i) => i.status === "owned");
  const pct = totals.cards ? Math.round((totals.have / totals.cards) * 100) : 0;
  const unpriced = missing.filter((i) => i.price === null).length;
  const list = shoppingList(missing);

  async function copy() {
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([list], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = t("lista-de-compra.txt", "shopping-list.txt");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {!hasCollection && (
        <Banner
          tone="warn"
          action={
            <Link className="btn btn-sm" href="/collection">
              {t("Importar colección", "Import collection")}
            </Link>
          }
        >
          <b>{t("No sé qué cartas tienes.", "I don't know which cards you have.")}</b>{" "}
          <span className="muted">
            {t(
              "Importa tu colección para ver qué te falta de verdad.",
              "Import your collection to see what you're really missing.",
            )}
          </span>
        </Banner>
      )}

      <section className="panel">
        <div
          className="grid-1-sm grid"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <Stat
            label={t("Ya las tienes", "You already have")}
            value={`${fmt(totals.have, locale)} / ${fmt(totals.cards, locale)}`}
            meta={t(
              `${pct} % del mazo, sin contar básicas`,
              `${pct}% of the deck, not counting basics`,
            )}
            tone="var(--color-in)"
          />
          <Stat
            label={t("En otros de tus mazos", "In your other decks")}
            value={fmt(totals.fromOtherDecks, locale)}
            meta={
              totals.fromOtherDecks
                ? t("Las tienes, pero las estás usando", "You own them, but they're in use")
                : t("Ninguna ocupada", "None in use")
            }
            tone={totals.fromOtherDecks ? "var(--color-inuse)" : undefined}
          />
          <Stat
            label={t("Te faltan", "Missing")}
            value={fmt(totals.toBuy, locale)}
            meta={
              totals.toBuy
                ? `≈ ${eur(totals.cost)}${unpriced ? t(` (+${unpriced} sin precio)`, ` (+${unpriced} unpriced)`) : ""}`
                : t("¡Puedes montarlo ya!", "You can build it now!")
            }
            tone={totals.toBuy ? "var(--color-out)" : "var(--color-in)"}
          />
        </div>
        <div className="px-4 pb-3.5">
          <div className="role-bar" style={{ height: 6 }}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {toCollection && toCollection.all.length > 0 && <DeckToCollection {...toCollection} />}

      {missing.length > 0 && (
        <section className="panel">
          <div className="panel-h stack-sm py-2">
            <span className="h2">
              {t("Para comprar", "To buy")}{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {fmt(totals.toBuy, locale)} · ≈ {eur(totals.cost)}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              {wishlist && (
                <button
                  type="button"
                  className={`btn ${wishlist.on ? "is-on" : ""}`}
                  aria-pressed={wishlist.on}
                  disabled={wishlist.busy}
                  title={t(
                    "Lo que falta entra en tu lista de deseos y se cruza con otros jugadores",
                    "What's missing goes on your wishlist and is matched with other players",
                  )}
                  onClick={wishlist.onToggle}
                >
                  {wishlist.on
                    ? t("En tu lista de deseos ✓", "On your wishlist ✓")
                    : t("Añadir a mi lista de deseos", "Add to my wishlist")}
                </button>
              )}
              <button type="button" className="btn" onClick={download}>
                {t("Descargar .txt", "Download .txt")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void copy()}>
                {copied
                  ? t("¡Copiada!", "Copied!")
                  : t("Copiar lista de compra", "Copy shopping list")}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table rtable">
              <thead>
                <tr>
                  <th className="r" style={{ width: 56 }}>
                    {t("Faltan", "Need")}
                  </th>
                  <th>{t("Carta", "Card")}</th>
                  <th className="r hide-sm">{t("Tienes", "Have")}</th>
                  <th className="r">{t("Precio", "Price")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {missing.map((i) => (
                  <tr key={i.card.oracleId}>
                    <td className="r mono rt-qty">{i.toBuy}</td>
                    <td className="rt-main">
                      <CardName item={i} />
                    </td>
                    <td className="r mono subtle hide-sm">{i.owned || "—"}</td>
                    <td className="r mono rt-end">
                      {i.price !== null ? (
                        <button
                          type="button"
                          className="linkbtn"
                          title={t("Ver el histórico de precio", "See the price history")}
                          onClick={() => setPriceCard(i.card)}
                        >
                          {eur(i.price * i.toBuy)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="r">
                      <a
                        className="btn btn-ghost btn-sm"
                        href={cardmarketUrl(i.card.name, locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t(`Comprar ${i.card.name}`, `Buy ${i.card.name}`)}
                      >
                        {t("Comprar ↗", "Buy ↗")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle px-3 py-2 text-xs">
            {t(
              "Precio de referencia del mercado europeo de la impresión más barata.",
              "European market reference price of the cheapest printing.",
            )}
          </p>
        </section>
      )}

      {ownership.alternatives.length > 0 && (
        <Alternatives groups={ownership.alternatives} hasCollection={hasCollection} />
      )}

      {elsewhere.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <span className="h2">
              {t("Las tienes en otros mazos", "In your other decks")}{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {fmt(totals.fromOtherDecks, locale)}
              </span>
            </span>
            <span className="subtle text-xs">
              {t("Muévelas o compra otra copia", "Move them or buy another copy")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table rtable">
              <tbody>
                {elsewhere.map((i) => (
                  <tr key={i.card.oracleId}>
                    <td className="r mono rt-qty" style={{ width: 56 }}>
                      {i.fromOtherDecks}
                    </td>
                    <td className="rt-main">
                      <CardName item={i} />
                    </td>
                    <td className="muted">
                      <UsedIn item={i} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {have.length > 0 && (
        <details className="issues">
          <summary>
            <span className="dot dot-owned" />
            <span>
              <b>{t("Ya las tienes libres", "Already free in your collection")}</b>{" "}
              <span className="muted">
                —{" "}
                {fmt(
                  have.reduce((n, i) => n + i.needed, 0),
                  locale,
                )}{" "}
                {t("copias", "copies")}
              </span>
            </span>
          </summary>
          <ul style={{ listStyle: "none", paddingLeft: 12 }}>
            {have.map((i) => (
              <li key={i.card.oracleId}>
                <span className="mono subtle">{i.needed}</span> <CardName item={i} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {!loggedIn && (
        <p className="subtle text-xs">
          {t(
            "Sin cuenta no se descuentan las cartas de otros mazos (no tienes mazos guardados).",
            "Without an account, cards in other decks aren't discounted (you have no saved decks).",
          )}
        </p>
      )}
      <CardPriceDialog card={priceCard} onClose={() => setPriceCard(null)} />
    </div>
  );
}

/** Para lo caro que falta: cartas del mismo papel que tengo libres o cuestan mucho menos. */
function Alternatives({
  groups,
  hasCollection,
}: {
  groups: OwnershipDTO["alternatives"];
  hasCollection: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="h2">{t("Alternativas más baratas", "Cheaper alternatives")}</span>
        <span className="subtle text-xs">
          {t(
            "Hacen el mismo papel y la comunidad las juega",
            "Same job, and the community plays them",
          )}
        </span>
      </div>
      <ul className="flex flex-col">
        {groups.map((g) => (
          <li
            key={g.card.oracleId}
            className="flex flex-col gap-1.5 border-t border-line px-3.5 py-2.5 first:border-t-0"
          >
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="muted text-xs">{t("En vez de", "Instead of")}</span>
              <CardHover card={g.card}>{g.card.name}</CardHover>
              <span className="mono subtle text-xs">{formatEuros(g.price, locale)}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {g.alternatives.map((a) => (
                <CardHover
                  key={a.card.oracleId}
                  card={a.card}
                  className="pill inline-flex items-center gap-1.5"
                >
                  {a.card.name}
                  <span className={`mono text-xs ${a.owned ? "" : "subtle"}`}>
                    {a.owned
                      ? hasCollection
                        ? t("la tienes", "you have it")
                        : t("gratis", "free")
                      : a.price !== null
                        ? formatEuros(a.price, locale)
                        : "—"}
                  </span>
                </CardHover>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
