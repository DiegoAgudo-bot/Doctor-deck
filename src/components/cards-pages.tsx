"use client";

/* eslint-disable @next/next/no-img-element -- símbolos de maná servidos desde /symbols */

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RARITIES, RARITY_LABELS, SUPERTYPE_LABELS, SUPERTYPES } from "@/domain/cards/attributes";
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
import { formatEuros } from "@/domain/suggestions/format";
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
import { Banner, CardGridSkeleton, EmptyState, fmt, Loading, SortDirButton } from "./ui";
import { AddToDeck } from "./add-to-deck";
import { ChipSet, FilterGroup, RangeFields, TextFilter } from "./filter-fields";

const RARITY_OPTIONS = RARITIES.map((r) => [r, RARITY_LABELS[r]] as const);
const SUPERTYPE_OPTIONS = SUPERTYPES.map((t) => [t, SUPERTYPE_LABELS[t]] as const);

/** Filtros avanzados del buscador (como los de ManaBox), plegados detrás de «Más filtros». */
function CatalogMoreFilters({
  q,
  set,
}: {
  q: CatalogQuery;
  set: (patch: Partial<CatalogQuery>) => void;
}) {
  return (
    <div className="filtergrid">
      <FilterGroup label="Texto de reglas">
        <TextFilter
          label="Texto de reglas"
          placeholder="roba una carta, draw a card…"
          value={q.oracle}
          onChange={(oracle) => set({ oracle })}
        />
      </FilterGroup>
      <FilterGroup label="Subtipo y habilidad">
        <span className="flex gap-2">
          <TextFilter
            label="Subtipo"
            placeholder="Elfo, Elf, Equipo…"
            value={q.subtype}
            onChange={(subtype) => set({ subtype })}
          />
          <TextFilter
            label="Habilidad clave"
            placeholder="Vuela, Flying, Arrolla…"
            value={q.keyword}
            onChange={(keyword) => set({ keyword })}
          />
        </span>
      </FilterGroup>
      <FilterGroup label="Supertipo">
        <ChipSet
          options={SUPERTYPE_OPTIONS}
          value={q.supertypes}
          onChange={(supertypes) => set({ supertypes })}
        />
      </FilterGroup>
      <FilterGroup label="Colores">
        <select
          className="select"
          aria-label="Qué colores mirar"
          value={q.colorBy}
          onChange={(e) => set({ colorBy: e.target.value as CatalogQuery["colorBy"] })}
        >
          <option value="identity">Identidad de color (lo que admite un mazo)</option>
          <option value="color">Color de la carta</option>
        </select>
      </FilterGroup>
      <FilterGroup label="Valor de maná">
        <RangeFields
          label="Valor de maná"
          min={q.cmcMin}
          max={q.cmcMax}
          onChange={(cmcMin, cmcMax) => set({ cmcMin, cmcMax, cmc: null })}
        />
      </FilterGroup>
      <FilterGroup label="Fuerza">
        <RangeFields
          label="Fuerza"
          min={q.powerMin}
          max={q.powerMax}
          onChange={(powerMin, powerMax) => set({ powerMin, powerMax })}
        />
      </FilterGroup>
      <FilterGroup label="Resistencia">
        <RangeFields
          label="Resistencia"
          min={q.toughnessMin}
          max={q.toughnessMax}
          onChange={(toughnessMin, toughnessMax) => set({ toughnessMin, toughnessMax })}
        />
      </FilterGroup>
      <FilterGroup label="Rareza (de alguna edición)">
        <ChipSet
          options={RARITY_OPTIONS}
          value={q.rarities}
          onChange={(rarities) => set({ rarities })}
        />
      </FilterGroup>
      <FilterGroup label="Edición y artista">
        <span className="flex gap-2">
          <TextFilter
            label="Código de edición"
            placeholder="Código: MH3, CMM…"
            value={q.set?.toUpperCase() ?? ""}
            onChange={(v) => {
              const code = v.trim().toLowerCase();
              set({ set: /^[a-z0-9]{2,6}$/.test(code) ? code : null });
            }}
          />
          <TextFilter
            label="Artista"
            placeholder="Artista"
            value={q.artist}
            onChange={(artist) => set({ artist: artist.trim() })}
          />
        </span>
      </FilterGroup>
    </div>
  );
}

const COLOR_LABEL = { W: "Blanco", U: "Azul", B: "Negro", R: "Rojo", G: "Verde" } as const;
const PAGE = 36;
const cardmarket = (name: string) =>
  `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

function CatalogTile({ card, delay }: { card: CatalogCardDTO; delay: number }) {
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
        <span className="mono subtle">{card.price !== null ? formatEuros(card.price) : "—"}</span>
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
      aria-label={`Precio ${label}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

/** /cards: buscador de cartas con filtros (en la URL) y su precio. */
export function CardsSearchPage() {
  const router = useRouter();
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
      if (id === request.current) setError(e instanceof ApiError ? e.message : "No se pudo buscar");
    } finally {
      if (id === request.current) setBusy(false);
    }
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
        <span className="eyebrow">Catálogo</span>
        <h1 className="h1">Buscar cartas</h1>
        <p className="muted text-[13px]">
          Busca por nombre, tipo o texto, en cualquier idioma. Pulsa una carta para ver su precio,
          sus ediciones, cuántas tienes y, si puede ser comandante, crear un mazo con ella.
        </p>
      </div>

      <section className="panel flex flex-col gap-3 p-3.5">
        <input
          className="input input-lg"
          type="search"
          placeholder="Sol Ring, Ángel de Serra, «roba una carta»…"
          aria-label="Buscar cartas"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Colores">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`manapick ${colorOn(c) ? "is-on" : ""}`}
                aria-pressed={colorOn(c)}
                title={COLOR_LABEL[c]}
                aria-label={COLOR_LABEL[c]}
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
              title="Incoloras"
              aria-label="Incoloras"
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
              aria-label="Cómo combinar los colores"
              value={q.colorMode}
              onChange={(e) => set({ colorMode: e.target.value as ColorMode })}
            >
              <option value="within">Caben en estos colores</option>
              <option value="exact">Exactamente estos</option>
              <option value="includes">Con al menos estos</option>
            </select>
          )}
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Tipo"
            value={q.type ?? ""}
            onChange={(e) => set({ type: (e.target.value || null) as CardType | null })}
          >
            <option value="">Todos los tipos</option>
            {(Object.entries(CARD_TYPES) as [CardType, string][]).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Coste de maná"
            value={q.cmc ?? ""}
            onChange={(e) => set({ cmc: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">Cualquier coste</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 7 ? "7 o más" : `Coste ${n}`}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Ordenar"
            value={q.sort}
            onChange={(e) => set({ sort: e.target.value as CatalogQuery["sort"], dir: null })}
          >
            <option value="popular">Más jugadas</option>
            <option value="price">Precio</option>
            <option value="name">Nombre</option>
            <option value="cmc">Coste</option>
          </select>
          <SortDirButton
            dir={catalogSortDir(q)}
            onChange={(dir) => set({ dir: dir === CATALOG_SORT_DEFAULT_DIR[q.sort] ? null : dir })}
          />
          <span className="flex items-center gap-1">
            <PriceInput label="mín. €" value={q.minPrice} onChange={setMinPrice} />
            <span className="subtle">–</span>
            <PriceInput label="máx. €" value={q.maxPrice} onChange={setMaxPrice} />
          </span>
          <label className="check">
            <input
              type="checkbox"
              checked={q.commander}
              onChange={(e) => set({ commander: e.target.checked })}
            />
            Puede ser comandante
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
            {extra > 0 ? `Más filtros · ${extra}` : "Más filtros"}
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
              Quitar filtros
            </button>
          )}
        </div>
        {moreOpen && <CatalogMoreFilters q={q} set={set} />}
      </section>

      {error && <Banner tone="out">{error}</Banner>}
      {!items && !error && <CardGridSkeleton count={18} label="Buscando…" />}
      {items && (
        <>
          <span className="subtle text-[13px]">
            {isEmptyQuery(q)
              ? `Las más jugadas en Commander · ${fmt(total)} cartas en el catálogo`
              : `${fmt(total)} ${total === 1 ? "carta" : "cartas"}`}
          </span>
          {items.length === 0 ? (
            <div className="panel">
              <EmptyState title="No hay cartas así">
                Prueba con otro nombre (en inglés) o quita algún filtro.
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
              {busy ? "Cargando…" : `Ver más (${fmt(total - items.length)})`}
            </button>
          )}
        </>
      )}
    </main>
  );
}

const PERIODS: [number, string][] = [
  [30, "30 días"],
  [90, "90 días"],
  [365, "1 año"],
];

/** /cards/{oracleId}: ficha de una carta. */
export function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [d, setD] = useState<CardDetailDTO | null>(null);
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
        setError(e instanceof ApiError ? e.message : "No se pudo cargar la carta"),
      );
  }, [id]);
  useEffect(() => {
    load();
  }, [load, session]);
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
      setNotice(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!d) {
    return (
      <main className="page">
        {error ? <Banner tone="out">{error}</Banner> : <Loading>Cargando la carta…</Loading>}
      </main>
    );
  }

  const printing = d.printings.find((p) => p.scryfallId === shown);
  const image = printing ? { ...d.card, imageUrl: printing.imageUrl ?? d.card.imageUrl } : d.card;
  const change = prices?.change;
  return (
    <main className="page">
      <Link className="subtle text-[13px]" href="/cards">
        ← Buscar cartas
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
            {d.commander && <span className="pill pill-in">Puede ser comandante</span>}
            {!d.legalCommander && <span className="pill pill-out">Prohibida en Commander</span>}
            {d.card.gameChanger && <span className="pill pill-warn">Game changer</span>}
            {d.roles.map((r) => (
              <span key={r.role} className={`pill ${r.primary ? "" : "subtle"}`}>
                {r.label}
              </span>
            ))}
            {d.edhrecRank !== null && (
              <span className="pill subtle" title="Puesto por número de mazos que la juegan">
                #{fmt(d.edhrecRank)} en popularidad
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
              <span className="cap">Desde</span>
              <b className="mono">{d.minPrice !== null ? formatEuros(d.minPrice) : "—"}</b>
            </div>
            <div>
              <span className="cap">Foil desde</span>
              <b className="mono">{d.minFoilPrice !== null ? formatEuros(d.minFoilPrice) : "—"}</b>
            </div>
            <a
              className="btn ml-auto"
              href={cardmarket(d.card.name)}
              target="_blank"
              rel="noreferrer"
            >
              Comprar ↗
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {d.commander && (
              <Link className="btn btn-primary" href={`/decks/new?commander=${d.card.oracleId}`}>
                <IconPlus size={14} /> Crear mazo con {d.card.name.split(",")[0]}
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
                      "Añadida a tu colección.",
                    )
                  }
                >
                  Añadir a mi colección
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
                        ? "Quitada de tu lista de deseos."
                        : "Añadida a tu lista de deseos.",
                    )
                  }
                >
                  {d.mine && d.mine.wished > 0 ? "Quitar de mi lista de deseos" : "Añadir a deseos"}
                </button>
                <AddToDeck card={{ ...d.card, canBeCommander: d.commander }} />
              </>
            )}
          </div>
          {notice && <Banner tone="in">{notice}</Banner>}
          {d.mine && (
            <p className="text-[13px]">
              {d.mine.owned === 0 ? (
                <span className="muted">No la tienes en tu colección.</span>
              ) : (
                <>
                  Tienes <b>{d.mine.owned}</b> {d.mine.owned === 1 ? "copia" : "copias"} ·{" "}
                  <b>{d.mine.free}</b> {d.mine.free === 1 ? "libre" : "libres"}
                  {d.mine.usedIn.length > 0 && (
                    <span className="subtle"> · en {d.mine.usedIn.join(", ")}</span>
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
            <h2 className="h2">Precio</h2>
            <div className="chips" role="radiogroup" aria-label="Periodo">
              {PERIODS.map(([n, label]) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={days === n}
                  className={`chipbtn ${days === n ? "is-on" : ""}`}
                  onClick={() => setDays(n)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {prices ? (
            <>
              <PriceChart points={prices.history} label="Precio" />
              {change && change.delta !== null && (
                <p className="text-[13px]">
                  <span className="muted">En el periodo: </span>
                  <b className="mono">{formatChange(change.delta, change.percent)}</b>
                </p>
              )}
            </>
          ) : (
            <Loading>Cargando precios…</Loading>
          )}
          <p className="subtle text-xs">
            Precio de referencia del mercado europeo de la edición más barata. El histórico se
            guarda cada noche para las cartas que hay en alguna colección o mazo.
          </p>
        </section>

        <section className="panel flex flex-col">
          <div className="panel-h">
            <span className="h2">Ediciones</span>
            <span className="subtle text-xs">{d.printings.length}</span>
          </div>
          <div className="scroll-sm" style={{ maxHeight: 360, overflow: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Edición</th>
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
                    title="Ver esta edición"
                  >
                    <td>
                      <span className="mono">{p.setCode.toUpperCase()}</span>{" "}
                      <span className="subtle">#{p.collectorNumber}</span>
                      <span className="subtle block truncate text-xs">
                        {p.setName ?? ""}
                        {p.releasedAt ? ` · ${p.releasedAt.slice(0, 4)}` : ""}
                      </span>
                    </td>
                    <td className="r mono">
                      {p.priceEur !== null ? formatEuros(p.priceEur) : "—"}
                    </td>
                    <td className="r mono">
                      {p.priceEurFoil !== null ? formatEuros(p.priceEurFoil) : "—"}
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
            <h2 className="h2">Mazos de la comunidad con {d.card.name.split(",")[0]}</h2>
            <Link className="text-[13px]" href={`/community?q=${encodeURIComponent(d.card.name)}`}>
              Ver en Comunidad
            </Link>
          </div>
          {d.commanderDecks.length === 0 ? (
            <p className="muted text-[13px]">
              Nadie ha publicado todavía un mazo con este comandante. ¡Sé el primero!
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
