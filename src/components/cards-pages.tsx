"use client";

/* eslint-disable @next/next/no-img-element -- símbolos de maná servidos desde /symbols */

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RARITIES, SUPERTYPES } from "@/domain/cards/attributes";
import {
  activeExtraFilters,
  CARD_TYPES,
  CATALOG_SORT_DEFAULT_DIR,
  catalogQueryParams,
  catalogSortDir,
  EMPTY_CATALOG_QUERY,
  isEmptyQuery,
  parseCatalogQuery,
  type CardType,
  type CatalogQuery,
  type ColorMode,
} from "@/domain/cards/catalog-search";
import { COLORS } from "@/domain/cards/types";
import {
  cardTypeLabel,
  colorName,
  rarityLabel,
  roleLabel,
  supertypeLabel,
} from "@/domain/i18n/labels";
import type { CardDetailDTO, CatalogCardDTO, CatalogPageDTO } from "@/server/card-dto";
import type { CardPricesDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { CommanderStaples } from "./commander-staples";
import { DeckTile } from "./deck-tile";
import { IconPlus } from "./icons";
import { notifyCollectionChanged } from "./local-collection";
import { ManaCost, ManaText, SYMBOL_URL } from "./mana";
import { formatChange, PriceChart } from "./price-chart";
import { restorePref, savePref } from "./prefs";
import { Banner, CardGridSkeleton, EmptyState, Loading, SortDirButton, useFormat } from "./ui";
import { AddToDeck } from "./add-to-deck";
import { ChipSet, FilterGroup, RangeFields, TextFilter } from "./filter-fields";
import { Link, useLocale, useRouter, useT } from "@/components/i18n";

/** Filtros avanzados del buscador (como los de ManaBox), plegados detrás de «Más filtros». */
function CatalogMoreFilters({
  q,
  set,
}: {
  q: CatalogQuery;
  set: (patch: Partial<CatalogQuery>) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const RARITY_OPTIONS = RARITIES.map((r) => [r, rarityLabel(r, locale)] as const);
  const SUPERTYPE_OPTIONS = SUPERTYPES.map((s) => [s, supertypeLabel(s, locale)] as const);
  return (
    <div className="filtergrid">
      <FilterGroup label={t("Texto de reglas", "Rules text")}>
        <TextFilter
          label={t("Texto de reglas", "Rules text")}
          placeholder={t("roba una carta, draw a card…", "draw a card, roba una carta…")}
          value={q.oracle}
          onChange={(oracle) => set({ oracle })}
        />
      </FilterGroup>
      <FilterGroup label={t("Subtipo y habilidad", "Subtype and keyword")}>
        <span className="flex gap-2">
          <TextFilter
            label={t("Subtipo", "Subtype")}
            placeholder={t("Elfo, Elf, Equipo…", "Elf, Equipment, Dragon…")}
            value={q.subtype}
            onChange={(subtype) => set({ subtype })}
          />
          <TextFilter
            label={t("Habilidad clave", "Keyword")}
            placeholder={t("Vuela, Flying, Arrolla…", "Flying, Trample, Haste…")}
            value={q.keyword}
            onChange={(keyword) => set({ keyword })}
          />
        </span>
      </FilterGroup>
      <FilterGroup label={t("Supertipo", "Supertype")}>
        <ChipSet
          options={SUPERTYPE_OPTIONS}
          value={q.supertypes}
          onChange={(supertypes) => set({ supertypes })}
        />
      </FilterGroup>
      <FilterGroup label={t("Colores", "Colors")}>
        <select
          className="select"
          aria-label={t("Qué colores mirar", "Which colors to check")}
          value={q.colorBy}
          onChange={(e) => set({ colorBy: e.target.value as CatalogQuery["colorBy"] })}
        >
          <option value="identity">
            {t("Identidad de color (lo que admite un mazo)", "Color identity (what a deck allows)")}
          </option>
          <option value="color">{t("Color de la carta", "Card color")}</option>
        </select>
      </FilterGroup>
      <FilterGroup label={t("Valor de maná", "Mana value")}>
        <RangeFields
          label={t("Valor de maná", "Mana value")}
          min={q.cmcMin}
          max={q.cmcMax}
          onChange={(cmcMin, cmcMax) => set({ cmcMin, cmcMax, cmc: null })}
        />
      </FilterGroup>
      <FilterGroup label={t("Fuerza", "Power")}>
        <RangeFields
          label={t("Fuerza", "Power")}
          min={q.powerMin}
          max={q.powerMax}
          onChange={(powerMin, powerMax) => set({ powerMin, powerMax })}
        />
      </FilterGroup>
      <FilterGroup label={t("Resistencia", "Toughness")}>
        <RangeFields
          label={t("Resistencia", "Toughness")}
          min={q.toughnessMin}
          max={q.toughnessMax}
          onChange={(toughnessMin, toughnessMax) => set({ toughnessMin, toughnessMax })}
        />
      </FilterGroup>
      <FilterGroup label={t("Rareza (de alguna edición)", "Rarity (of any printing)")}>
        <ChipSet
          options={RARITY_OPTIONS}
          value={q.rarities}
          onChange={(rarities) => set({ rarities })}
        />
      </FilterGroup>
      <FilterGroup label={t("Edición y artista", "Set and artist")}>
        <span className="flex gap-2">
          <TextFilter
            label={t("Código de edición", "Set code")}
            placeholder={t("Código: MH3, CMM…", "Code: MH3, CMM…")}
            value={q.set?.toUpperCase() ?? ""}
            onChange={(v) => {
              const code = v.trim().toLowerCase();
              set({ set: /^[a-z0-9]{2,6}$/.test(code) ? code : null });
            }}
          />
          <TextFilter
            label={t("Artista", "Artist")}
            placeholder={t("Artista", "Artist")}
            value={q.artist}
            onChange={(artist) => set({ artist: artist.trim() })}
          />
        </span>
      </FilterGroup>
    </div>
  );
}

const PAGE = 36;
const cardmarket = (name: string, lang: string) =>
  `https://www.cardmarket.com/${lang}/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

function CatalogTile({ card, delay }: { card: CatalogCardDTO; delay: number }) {
  const { eur } = useFormat();
  return (
    <Link
      href={`/cards/${card.oracleId}`}
      className="catalogtile fade"
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <span className="cardbtn">
        <CardImage card={card} sizes="(max-width: 760px) 30vw, 180px" />
      </span>
      <span className="catalogtile-meta">
        <span className="truncate">{card.name}</span>
        <span className="mono subtle">{card.price !== null ? eur(card.price) : "—"}</span>
      </span>
    </Link>
  );
}

/** Lo que se recuerda del buscador: los filtros y el orden (como parámetros de URL), sin el texto. */
const parseCardsPref = (raw: unknown): CatalogQuery | null =>
  typeof raw === "object" && raw !== null && typeof (raw as { query?: unknown }).query === "string"
    ? parseCatalogQuery(new URLSearchParams((raw as { query: string }).query))
    : null;

/** "5" / "0,5" → número; vacío → null. */
const euros = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
};

/** Precio mínimo o máximo: se aplica al dejar de escribir. */
function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const t = useT();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refleja el valor que llega de fuera
    setDraft(value === null ? "" : String(value));
  }, [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (euros(draft) !== value) onChange(euros(draft));
    }, 500);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <input
      className="input"
      style={{ width: 92 }}
      inputMode="decimal"
      placeholder={label}
      aria-label={`${t("Precio", "Price")} ${label}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

/** /cards: buscador de cartas con filtros (en la URL) y su precio. */
export function CardsSearchPage() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const { fmt } = useFormat();
  const params = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [q, setQ] = useState<CatalogQuery>(() => parseCatalogQuery(new URLSearchParams(params)));
  const [text, setText] = useState(q.text);
  /** Si se entra sin filtros en la URL, primero se recuperan los guardados. */
  const [ready, setReady] = useState(() => [...new URLSearchParams(params).keys()].length > 0);
  const [items, setItems] = useState<CatalogCardDTO[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  const set = (patch: Partial<CatalogQuery>) => setQ((x) => ({ ...x, ...patch }));

  // Escribir: con un pequeño retardo.
  useEffect(() => {
    const t = setTimeout(
      () => setQ((x) => (x.text === text.trim() ? x : { ...x, text: text.trim() })),
      250,
    );
    return () => clearTimeout(t);
  }, [text]);

  const load = useCallback(async (query: CatalogQuery, offset: number) => {
    const id = ++request.current;
    setBusy(true);
    try {
      const p = catalogQueryParams(query);
      p.set("offset", String(offset));
      p.set("limit", String(PAGE));
      const page = await api<CatalogPageDTO>(`/api/cards?${p}`);
      if (id !== request.current) return;
      setItems((x) => (offset ? [...(x ?? []), ...page.items] : page.items));
      setTotal(page.total);
      setError(null);
    } catch (e) {
      if (id === request.current)
        setError(e instanceof ApiError ? e.message : t("No se pudo buscar", "Search failed"));
    } finally {
      if (id === request.current) setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` no cambia en la página
  }, []);

  useEffect(() => {
    if (ready || isPending) return;
    return restorePref(
      "cards",
      parseCardsPref,
      loggedIn,
      (saved) => setQ((x) => ({ ...saved, text: x.text })),
      () => setReady(true),
    );
  }, [ready, isPending, loggedIn]);

  useEffect(() => {
    if (!ready || isPending) return;
    savePref("cards", { query: catalogQueryParams({ ...q, text: "" }).toString() }, loggedIn);
  }, [q, ready, isPending, loggedIn]);

  // Cada cambio de filtros: a la URL (para compartir o volver atrás) y primera página.
  useEffect(() => {
    if (!ready) return;
    const p = catalogQueryParams(q).toString();
    router.replace(`/cards${p ? `?${p}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca al cambiar los filtros
    void load(q, 0);
  }, [q, load, router, ready]);
  const setMinPrice = useCallback((v: number | null) => set({ minPrice: v }), []);
  const setMaxPrice = useCallback((v: number | null) => set({ maxPrice: v }), []);

  const colorOn = (c: (typeof COLORS)[number]) => q.colors.includes(c);
  const extra = activeExtraFilters(q);
  const [moreOpen, setMoreOpen] = useState(extra > 0);
  return (
    <main className="page">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">{t("Catálogo", "Catalog")}</span>
        <h1 className="h1">{t("Buscar cartas", "Search cards")}</h1>
        <p className="muted text-[13px]">
          {t(
            "Busca por nombre, tipo o texto, en cualquier idioma. Pulsa una carta para ver su precio, sus ediciones, cuántas tienes y, si puede ser comandante, crear un mazo con ella.",
            "Search by name, type or text, in any language. Tap a card to see its price, its printings, how many you own and, if it can be a commander, build a deck with it.",
          )}
        </p>
      </div>

      <section className="panel flex flex-col gap-3 p-3.5">
        <input
          className="input input-lg"
          type="search"
          placeholder={t(
            "Sol Ring, Ángel de Serra, «roba una carta»…",
            "Sol Ring, Serra Angel, “draw a card”…",
          )}
          aria-label={t("Buscar cartas", "Search cards")}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label={t("Colores", "Colors")}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`manapick ${colorOn(c) ? "is-on" : ""}`}
                aria-pressed={colorOn(c)}
                title={colorName(c, locale)}
                aria-label={colorName(c, locale)}
                style={{ opacity: colorOn(c) || (q.colors.length === 0 && !q.colorless) ? 1 : 0.4 }}
                onClick={() =>
                  set({
                    colorless: false,
                    colors: colorOn(c) ? q.colors.filter((x) => x !== c) : [...q.colors, c],
                  })
                }
              >
                <img src={`${SYMBOL_URL}${c}.svg`} alt="" width={20} height={20} />
              </button>
            ))}
            <button
              type="button"
              className={`manapick ${q.colorless ? "is-on" : ""}`}
              aria-pressed={q.colorless}
              title={t("Incoloras", "Colorless")}
              aria-label={t("Incoloras", "Colorless")}
              style={{ opacity: q.colorless || q.colors.length === 0 ? 1 : 0.4 }}
              onClick={() => set({ colorless: !q.colorless, colors: [] })}
            >
              <img src={`${SYMBOL_URL}C.svg`} alt="" width={20} height={20} />
            </button>
          </div>
          {q.colors.length > 0 && (
            <select
              className="select"
              style={{ width: "auto" }}
              aria-label={t("Cómo combinar los colores", "How to combine the colors")}
              value={q.colorMode}
              onChange={(e) => set({ colorMode: e.target.value as ColorMode })}
            >
              <option value="within">{t("Caben en estos colores", "Within these colors")}</option>
              <option value="exact">{t("Exactamente estos", "Exactly these")}</option>
              <option value="includes">{t("Con al menos estos", "Including these")}</option>
            </select>
          )}
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label={t("Tipo", "Type")}
            value={q.type ?? ""}
            onChange={(e) => set({ type: (e.target.value || null) as CardType | null })}
          >
            <option value="">{t("Todos los tipos", "All types")}</option>
            {(Object.keys(CARD_TYPES) as CardType[]).map((k) => (
              <option key={k} value={k}>
                {cardTypeLabel(k, locale)}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label={t("Coste de maná", "Mana cost")}
            value={q.cmc ?? ""}
            onChange={(e) => set({ cmc: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">{t("Cualquier coste", "Any cost")}</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 7 ? t("7 o más", "7 or more") : t(`Coste ${n}`, `Cost ${n}`)}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label={t("Ordenar", "Sort")}
            value={q.sort}
            onChange={(e) => set({ sort: e.target.value as CatalogQuery["sort"], dir: null })}
          >
            <option value="popular">{t("Más jugadas", "Most played")}</option>
            <option value="price">{t("Precio", "Price")}</option>
            <option value="name">{t("Nombre", "Name")}</option>
            <option value="cmc">{t("Coste", "Cost")}</option>
          </select>
          <SortDirButton
            dir={catalogSortDir(q)}
            onChange={(dir) => set({ dir: dir === CATALOG_SORT_DEFAULT_DIR[q.sort] ? null : dir })}
          />
          <span className="flex items-center gap-1">
            <PriceInput label={t("mín. €", "min €")} value={q.minPrice} onChange={setMinPrice} />
            <span className="subtle">–</span>
            <PriceInput label={t("máx. €", "max €")} value={q.maxPrice} onChange={setMaxPrice} />
          </span>
          <label className="check">
            <input
              type="checkbox"
              checked={q.commander}
              onChange={(e) => set({ commander: e.target.checked })}
            />
            {t("Puede ser comandante", "Can be commander")}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={q.gameChanger}
              onChange={(e) => set({ gameChanger: e.target.checked })}
            />
            Game changers
          </label>
          <button
            type="button"
            className={`btn ${moreOpen ? "is-on" : ""}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            {extra > 0
              ? `${t("Más filtros", "More filters")} · ${extra}`
              : t("Más filtros", "More filters")}
          </button>
          {!isEmptyQuery(q) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setText("");
                setQ({ ...EMPTY_CATALOG_QUERY, sort: q.sort, dir: q.dir });
              }}
            >
              {t("Quitar filtros", "Clear filters")}
            </button>
          )}
        </div>
        {moreOpen && <CatalogMoreFilters q={q} set={set} />}
      </section>

      {error && <Banner tone="out">{error}</Banner>}
      {!items && !error && <CardGridSkeleton count={18} label={t("Buscando…", "Searching…")} />}
      {items && (
        <>
          <span className="subtle text-[13px]">
            {isEmptyQuery(q)
              ? t(
                  `Las más jugadas en Commander · ${fmt(total)} cartas en el catálogo`,
                  `Most played in Commander · ${fmt(total)} cards in the catalog`,
                )
              : total === 1
                ? t("1 carta", "1 card")
                : t(`${fmt(total)} cartas`, `${fmt(total)} cards`)}
          </span>
          {items.length === 0 ? (
            <div className="panel">
              <EmptyState title={t("No hay cartas así", "No cards like that")}>
                {t(
                  "Prueba con otro nombre (en inglés) o quita algún filtro.",
                  "Try another name or remove a filter.",
                )}
              </EmptyState>
            </div>
          ) : (
            <div className="catalog" aria-busy={busy}>
              {items.map((c, i) => (
                <CatalogTile key={c.oracleId} card={c} delay={Math.min(i % PAGE, 18) * 20} />
              ))}
            </div>
          )}
          {items.length < total && (
            <button
              type="button"
              className="btn self-center"
              disabled={busy}
              onClick={() => void load(q, items.length)}
            >
              {busy
                ? t("Cargando…", "Loading…")
                : `${t("Ver más", "Show more")} (${fmt(total - items.length)})`}
            </button>
          )}
        </>
      )}
    </main>
  );
}

const PERIODS: [number, string, string][] = [
  [30, "30 días", "30 days"],
  [90, "90 días", "90 days"],
  [365, "1 año", "1 year"],
];

/** /cards/{oracleId}: ficha de una carta. */
/** `initial`: la ficha sin sesión, pintada en el servidor (con sesión se vuelve a pedir). */
export function CardDetailPage({ initial }: { initial?: CardDetailDTO }) {
  const { id } = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const t = useT();
  const locale = useLocale();
  const { fmt, eur } = useFormat();
  const [d, setD] = useState<CardDetailDTO | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [prices, setPrices] = useState<CardPricesDTO | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<CardDetailDTO>(`/api/cards/${encodeURIComponent(id)}`, undefined, { silent: true })
      .then(setD)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError
            ? e.message
            : t("No se pudo cargar la carta", "Couldn't load the card"),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` no cambia en la página
  }, [id]);
  useEffect(() => {
    // Sin sesión, la del servidor ya es la buena.
    if (initial && !session) return;
    load();
  }, [load, session, initial]);
  useEffect(() => {
    api<CardPricesDTO>(`/api/cards/${encodeURIComponent(id)}/prices?days=${days}`, undefined, {
      silent: true,
    })
      .then(setPrices)
      .catch(() => setPrices(null));
  }, [id, days]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      setNotice(message);
      load();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : t("No se pudo guardar", "Couldn't save"));
    } finally {
      setBusy(false);
    }
  }

  if (!d) {
    return (
      <main className="page">
        {error ? (
          <Banner tone="out">{error}</Banner>
        ) : (
          <Loading>{t("Cargando la carta…", "Loading the card…")}</Loading>
        )}
      </main>
    );
  }

  const printing = d.printings.find((p) => p.scryfallId === shown);
  const image = printing ? { ...d.card, imageUrl: printing.imageUrl ?? d.card.imageUrl } : d.card;
  const change = prices?.change;
  return (
    <main className="page">
      <Link className="subtle text-[13px]" href="/cards">
        ← {t("Buscar cartas", "Search cards")}
      </Link>
      <section className="cardhero">
        <div className="cardhero-art">
          <CardImage card={image} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="h1">{d.card.name}</h1>
            <ManaCost cost={d.card.manaCost} large />
          </div>
          <span className="muted">{d.card.typeLine}</span>
          <div className="flex flex-wrap gap-1.5">
            {d.commander && (
              <span className="pill pill-in">{t("Puede ser comandante", "Can be commander")}</span>
            )}
            {!d.legalCommander && (
              <span className="pill pill-out">
                {t("Prohibida en Commander", "Banned in Commander")}
              </span>
            )}
            {d.card.gameChanger && <span className="pill pill-warn">Game changer</span>}
            {d.roles.map((r) => (
              <span key={r.role} className={`pill ${r.primary ? "" : "subtle"}`}>
                {roleLabel(r.role, locale)}
              </span>
            ))}
            {d.edhrecRank !== null && (
              <span
                className="pill subtle"
                title={t(
                  "Puesto por número de mazos que la juegan",
                  "Rank by number of decks that play it",
                )}
              >
                #{fmt(d.edhrecRank)} {t("en popularidad", "in popularity")}
              </span>
            )}
          </div>
          {d.oracleText && (
            <div className="oracle">
              <ManaText text={d.oracleText} />
            </div>
          )}

          <div className="pricebox">
            <div>
              <span className="cap">{t("Desde", "From")}</span>
              <b className="mono">{d.minPrice !== null ? eur(d.minPrice) : "—"}</b>
            </div>
            <div>
              <span className="cap">{t("Foil desde", "Foil from")}</span>
              <b className="mono">{d.minFoilPrice !== null ? eur(d.minFoilPrice) : "—"}</b>
            </div>
            <a
              className="btn ml-auto"
              href={cardmarket(d.card.name, locale)}
              target="_blank"
              rel="noreferrer"
            >
              {t("Comprar ↗", "Buy ↗")}
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {d.commander && (
              <Link className="btn btn-primary" href={`/decks/new?commander=${d.card.oracleId}`}>
                <IconPlus size={14} /> {t("Crear mazo con", "Build a deck with")}{" "}
                {d.card.name.split(",")[0]}
              </Link>
            )}
            {loggedIn && (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        api("/api/collection/cards", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            cards: [{ oracleId: d.card.oracleId, quantity: 1 }],
                          }),
                        }).then(() => notifyCollectionChanged()),
                      t("Añadida a tu colección.", "Added to your collection."),
                    )
                  }
                >
                  {t("Añadir a mi colección", "Add to my collection")}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        api(`/api/trades/wishes/${d.card.oracleId}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ quantity: d.mine && d.mine.wished > 0 ? 0 : 1 }),
                        }),
                      d.mine && d.mine.wished > 0
                        ? t("Quitada de tu lista de deseos.", "Removed from your wishlist.")
                        : t("Añadida a tu lista de deseos.", "Added to your wishlist."),
                    )
                  }
                >
                  {d.mine && d.mine.wished > 0
                    ? t("Quitar de mi lista de deseos", "Remove from my wishlist")
                    : t("Añadir a deseos", "Add to wishlist")}
                </button>
                <AddToDeck card={{ ...d.card, canBeCommander: d.commander }} />
              </>
            )}
          </div>
          {notice && <Banner tone="in">{notice}</Banner>}
          {d.mine && (
            <p className="text-[13px]">
              {d.mine.owned === 0 ? (
                <span className="muted">
                  {t("No la tienes en tu colección.", "It's not in your collection.")}
                </span>
              ) : (
                <>
                  {t("Tienes", "You own")} <b>{d.mine.owned}</b>{" "}
                  {d.mine.owned === 1 ? t("copia", "copy") : t("copias", "copies")} ·{" "}
                  <b>{d.mine.free}</b> {t(d.mine.free === 1 ? "libre" : "libres", "free")}
                  {d.mine.usedIn.length > 0 && (
                    <span className="subtle">
                      {" "}
                      · {t("en", "in")} {d.mine.usedIn.join(", ")}
                    </span>
                  )}
                </>
              )}
            </p>
          )}
        </div>
      </section>

      <div
        className="grid-1-sm grid gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
      >
        <section className="panel flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h2">{t("Precio", "Price")}</h2>
            <div className="chips" role="radiogroup" aria-label={t("Periodo", "Period")}>
              {PERIODS.map(([n, es, en]) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={days === n}
                  className={`chipbtn ${days === n ? "is-on" : ""}`}
                  onClick={() => setDays(n)}
                >
                  {t(es, en)}
                </button>
              ))}
            </div>
          </div>
          {prices ? (
            <>
              <PriceChart points={prices.history} label={t("Precio", "Price")} />
              {change && change.delta !== null && (
                <p className="text-[13px]">
                  <span className="muted">{t("En el periodo: ", "Over the period: ")}</span>
                  <b className="mono">{formatChange(change.delta, change.percent, locale)}</b>
                </p>
              )}
            </>
          ) : (
            <Loading>{t("Cargando precios…", "Loading prices…")}</Loading>
          )}
          <p className="subtle text-xs">
            {t(
              "Precio de referencia del mercado europeo de la edición más barata. El histórico se guarda cada noche para las cartas que hay en alguna colección o mazo.",
              "European market reference price of the cheapest printing. History is recorded every night for cards that are in some collection or deck.",
            )}
          </p>
        </section>

        <section className="panel flex flex-col">
          <div className="panel-h">
            <span className="h2">{t("Ediciones", "Printings")}</span>
            <span className="subtle text-xs">{d.printings.length}</span>
          </div>
          <div className="scroll-sm" style={{ maxHeight: 360, overflow: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Edición", "Set")}</th>
                  <th className="r">Normal</th>
                  <th className="r">Foil</th>
                </tr>
              </thead>
              <tbody>
                {d.printings.map((p) => (
                  <tr
                    key={p.scryfallId}
                    className={`cursor-pointer ${shown === p.scryfallId ? "is-on" : ""}`}
                    onClick={() => setShown(p.scryfallId)}
                    title={t("Ver esta edición", "Show this printing")}
                  >
                    <td>
                      <span className="mono">{p.setCode.toUpperCase()}</span>{" "}
                      <span className="subtle">#{p.collectorNumber}</span>
                      <span className="subtle block truncate text-xs">
                        {p.setName ?? ""}
                        {p.releasedAt ? ` · ${p.releasedAt.slice(0, 4)}` : ""}
                      </span>
                    </td>
                    <td className="r mono">{p.priceEur !== null ? eur(p.priceEur) : "—"}</td>
                    <td className="r mono">
                      {p.priceEurFoil !== null ? eur(p.priceEurFoil) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {d.commander && (
        <CommanderStaples oracleId={d.card.oracleId} name={d.card.name} loggedIn={loggedIn} />
      )}

      {d.commander && (
        <section className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <h2 className="h2">
              {t("Mazos de la comunidad con", "Community decks with")} {d.card.name.split(",")[0]}
            </h2>
            <Link className="text-[13px]" href={`/community?q=${encodeURIComponent(d.card.name)}`}>
              {t("Ver en Comunidad", "See in Community")}
            </Link>
          </div>
          {d.commanderDecks.length === 0 ? (
            <p className="muted text-[13px]">
              {t(
                "Nadie ha publicado todavía un mazo con este comandante. ¡Sé el primero!",
                "Nobody has published a deck with this commander yet. Be the first!",
              )}
            </p>
          ) : (
            <div
              className="grid-1-sm grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              {d.commanderDecks.map((deck, i) => (
                <DeckTile
                  key={deck.id}
                  deck={deck}
                  owner={deck.owner ? { username: deck.owner, name: deck.owner } : undefined}
                  delay={i * 40}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
