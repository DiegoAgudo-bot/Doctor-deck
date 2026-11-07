"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { languageBadge, languageLabel } from "@/domain/cards/languages";
import {
  COLLECTION_SORT_DEFAULT_DIR,
  type CollectionSort,
  unitPrice,
} from "@/domain/collection/browse";
import { sinceAddedTrend } from "@/domain/collection/since-added";
import { formatEuros } from "@/domain/suggestions/format";
import type {
  CardDTO,
  CollectionCardDTO,
  CollectionTotals,
  CollectionViewResponse,
} from "@/server/dto";

type Facets = NonNullable<CollectionViewResponse["facets"]>;
import { readCached, writeCached } from "./swr-cache";
import { api, ApiError } from "./api-client";
import { CardHover, CardImage } from "./card-image";
import { CardPriceDialog } from "./card-price-dialog";
import { CollectionCardDialog } from "./collection-card-dialog";
import { notifyCollectionChanged } from "./local-collection";
import { localRoles } from "./local-roles";
import { roleLabel } from "./deck-views";
import { ManaCost, SYMBOL_URL } from "./mana";
import { restorePref, savePref } from "./prefs";
import { Banner, CardGridSkeleton, fmt, SortDirButton } from "./ui";
import {
  anyActive,
  COLORS,
  CollectionMoreFilters,
  EMPTY,
  type ColorKey,
  type ColorMode,
  type Filters,
  moreActiveCount,
  parseCollectionPref,
  prefOf,
  toQuery,
  type View,
} from "./collection-filters";
import { useLocale, useT, type T } from "./i18n";
import type { Locale } from "@/domain/i18n/locale";

/* eslint-disable @next/next/no-img-element -- símbolos de maná de Scryfall en los filtros */

const colorLabel = (c: ColorKey, t: T) =>
  ({
    W: t("Blanco", "White"),
    U: t("Azul", "Blue"),
    B: t("Negro", "Black"),
    R: t("Rojo", "Red"),
    G: t("Verde", "Green"),
    C: t("Incoloro", "Colorless"),
  })[c];

type Sort = CollectionSort;

/** Cartas por página: la colección se pide al servidor por trozos ("Ver más"). */
const PAGE = 48;
const front = (typeLine: string) => typeLine.split("//")[0] ?? typeLine;

/**
 * Pestaña "Mis cartas": la colección agrupada por carta, con filtros, orden y dos vistas. El
 * servidor filtra, ordena y pagina; aquí solo se pide la página siguiente con "Ver más".
 * `localPairs`: sin cuenta, la colección del navegador. `version` cambia cuando la colección cambia.
 */
/** "3 copias: 12,40 € (según su edición y si son foil). Clic: histórico de precio." */
const valueTitle = (c: CollectionCardDTO, t: T, l: Locale) =>
  t(
    `${c.quantity} ${c.quantity === 1 ? "copia" : "copias"}: lo que valen según su edición y si son foil${
      c.price !== null ? ` (la más barata, ${formatEuros(c.price)} c/u)` : ""
    }. Clic para ver el histórico de precio.`,
    `${c.quantity} ${c.quantity === 1 ? "copy" : "copies"}: what they're worth by printing and foil${
      c.price !== null ? ` (cheapest, ${formatEuros(c.price, l)} each)` : ""
    }. Click to see the price history.`,
  );

/** Ordenando por precio, lo que vale cada copia («c/u»); si no, lo que valen todas. */
const priceLabel = (c: CollectionCardDTO, sort: Sort, t: T, l: Locale) =>
  sort === "precio" && c.quantity > 1
    ? `${formatEuros(unitPrice(c) ?? 0, l)} ${t("c/u", "each")}`
    : formatEuros(c.value ?? c.price ?? 0, l);

/** En la tarjeta: el precio de hoy de una copia (el de compra solo sirve para la variación). */
const tileTitle = (c: CollectionCardDTO, t: T, l: Locale) =>
  `${t("Precio actual por copia (según su edición y si es foil).", "Current price per copy (by printing and foil).")}${
    c.quantity > 1 && c.value !== null
      ? t(
          ` Tus ${c.quantity} copias valen ${formatEuros(c.value)}.`,
          ` Your ${c.quantity} copies are worth ${formatEuros(c.value, l)}.`,
        )
      : ""
  } ${t("Clic para ver el histórico de precio.", "Click to see the price history.")}`;

/** Idiomas de las copias que no son en inglés ("ES ×2"); en inglés no se marca nada. */
function LanguagePills({ card }: { card: CollectionCardDTO }) {
  const t = useT();
  const locale = useLocale();
  return card.languages
    .filter((l) => l.language !== "en")
    .map((l) => (
      <span
        key={l.language}
        className="pill"
        title={t(
          `${l.quantity} en ${languageLabel(l.language)}`,
          `${l.quantity} in ${languageLabel(l.language, locale)}`,
        )}
      >
        {languageBadge(l.language)}
        {card.quantity > 1 ? ` ×${l.quantity}` : ""}
      </span>
    ));
}

/** La edición de la carta (la de la impresión que se enseña) y cuántas más hay. */
function SetLine({ card }: { card: CollectionCardDTO }) {
  const t = useT();
  const set = card.set;
  if (!set) {
    return <span className="ctile-set subtle">{t("Edición desconocida", "Unknown printing")}</span>;
  }
  const more = card.sets.filter((code) => code !== set.code).length;
  return (
    <span
      className="ctile-set"
      title={
        more > 0
          ? t(
              `${set.name ?? set.code} y ${card.sets.length - 1} más: ${card.sets.join(", ")}`,
              `${set.name ?? set.code} and ${card.sets.length - 1} more: ${card.sets.join(", ")}`,
            )
          : (set.name ?? set.code)
      }
    >
      <span className="mono ctile-setcode">{set.code}</span>
      {set.name && <span className="ctile-setname">{set.name}</span>}
      {more > 0 && <span className="subtle">+{more}</span>}
    </span>
  );
}

/** Cuánto ha subido o bajado lo que valen mis copias desde que las añadí (▲ 12 % · desde nov 2025). */
function SinceAdded({ card }: { card: CollectionCardDTO }) {
  const t = useT();
  const locale = useLocale();
  const trend = sinceAddedTrend(card.sinceAdded, locale);
  const s = card.sinceAdded;
  if (!trend || !s) {
    return (
      <span
        className="ctile-trend subtle"
        title={t(
          "No se sabe cuánto valía cuando la añadiste",
          "Unknown what it was worth when you added it",
        )}
      >
        {t("Sin precio de entrada", "No entry price")}
      </span>
    );
  }
  const eur = (x: number) => formatEuros(x, locale);
  const diff = `${trend.diff > 0 ? "+" : trend.diff < 0 ? "−" : ""}${eur(Math.abs(trend.diff))}`;
  return (
    <span
      className={`ctile-trend is-${trend.tone}`}
      title={t(
        `Desde el ${trend.day}: valía ${eur(s.paid)}, hoy ${eur(s.now)} (${diff})`,
        `Since ${trend.day}: it was worth ${eur(s.paid)}, today ${eur(s.now)} (${diff})`,
      )}
    >
      <span aria-hidden="true">{trend.arrow}</span>
      <span className="ctile-pct">{trend.percent}</span>
      <span className="subtle">
        {t("desde", "since")} {trend.month}
      </span>
    </span>
  );
}

export function CollectionBrowser({
  loggedIn,
  localPairs,
  version,
  username,
}: {
  loggedIn: boolean;
  localPairs: [string, number][] | null;
  version: number;
  /** La colección pública de otro usuario (en su perfil). */
  username?: string | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const n = (x: number) => fmt(x, locale);
  const eur = (x: number) => formatEuros(x, locale);
  const [f, setF] = useState<Filters>(EMPTY);
  const [view, setView] = useState<View>("cuadricula");
  /** Hasta recuperar los filtros guardados no se pide nada (si no, se pediría dos veces). */
  /** Mis filtros se recuerdan; los de la colección de otro, no. */
  const remember = !username;
  const [ready, setReady] = useState(!remember);
  /** En el móvil los filtros van plegados (solo el buscador a la vista). */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Carta cuyo histórico de precio se está viendo. */
  const [priceCard, setPriceCard] = useState<CardDTO | null>(null);
  /** Carta que se está editando copia a copia (solo en mi colección, con cuenta). */
  const [editCard, setEditCard] = useState<CardDTO | null>(null);
  const editable = loggedIn && !username;
  const [items, setItems] = useState<CollectionCardDTO[] | null>(null);
  const [total, setTotal] = useState<CollectionTotals | null>(null);
  const [facets, setFacets] = useState<Facets>({ sets: [] });
  /** Con qué filtros (y `version`) son los resultados que se ven: si no son los de ahora, se está buscando. */
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));

  const fetchPage = useCallback(
    (offset: number, signal?: AbortSignal) =>
      api<CollectionViewResponse>("/api/collection/view", {
        method: "POST",
        ...(signal ? { signal } : {}),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(username ? { username } : !loggedIn && localPairs ? { collection: localPairs } : {}),
          ...(!username && !loggedIn ? { roleEdits: localRoles.all() } : {}),
          filters: toQuery(f),
          sort: f.sort,
          ...(f.dir ? { dir: f.dir } : {}),
          offset,
          limit: PAGE,
        }),
      }),
    [f, loggedIn, localPairs, username],
  );

  useEffect(() => {
    if (!remember) return;
    return restorePref(
      "collection",
      parseCollectionPref,
      loggedIn,
      (p) => {
        setF((prev) => ({ ...prev, ...p.filters }));
        setView(p.view);
      },
      () => setReady(true),
    );
  }, [remember, loggedIn]);

  useEffect(() => {
    if (!ready || !remember) return;
    savePref("collection", prefOf(f, view), loggedIn);
  }, [f, view, ready, remember, loggedIn]);

  // Primera página al cambiar filtros u orden (con un respiro mientras se escribe en el buscador).
  // Mi colección: la primera página de la última vez (si era con estos filtros) al momento.
  const cacheable = remember && loggedIn;
  const signature = JSON.stringify({ filters: toQuery(f), sort: f.sort, dir: f.dir });
  useEffect(() => {
    if (!ready || !cacheable) return;
    const cached = readCached<{ sig: string; items: CollectionCardDTO[]; total: CollectionTotals }>(
      "collection-first",
    );
    if (cached?.sig !== signature) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo guardado del navegador, una vez
    setItems((x) => x ?? cached.items);
    setTotal((x) => x ?? cached.total);
  }, [ready, cacheable, signature]);

  const wanted = `${version}|${signature}`;
  // Se está buscando desde la pulsación (no solo cuando sale la petición tras el respiro).
  const loading = ready && shownFor !== wanted;
  useEffect(() => {
    if (!ready) return;
    const id = ++request.current;
    // La búsqueda anterior ya no vale: se cancela para que no haga cola en el servidor.
    const abort = new AbortController();
    const timer = setTimeout(
      () => {
        fetchPage(0, abort.signal)
          .then((r) => {
            if (id !== request.current) return;
            setError(null);
            setItems(r.items);
            setTotal(r.total);
            if (r.facets) setFacets(r.facets);
            if (cacheable) {
              writeCached("collection-first", { sig: signature, items: r.items, total: r.total });
            }
          })
          .catch((e: unknown) => {
            if (id === request.current) {
              setError(
                e instanceof ApiError
                  ? e.message
                  : t("No se pudo cargar la colección", "Couldn't load the collection"),
              );
            }
          })
          .finally(() => id === request.current && setShownFor(wanted));
      },
      f.q ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo cambia con el idioma (recarga)
  }, [fetchPage, version, f.q, ready, cacheable, signature, wanted]);

  async function loadMore() {
    if (!items) return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const r = await fetchPage(items.length);
      if (id !== request.current) return;
      setItems([...items, ...r.items]);
      setTotal(r.total);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudieron cargar más cartas", "Couldn't load more cards"),
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const shown = items ?? [];
  const copies = total?.copies ?? 0;
  const value = total?.value ?? 0;
  const remaining = total ? total.cards - shown.length : 0;
  const active = anyActive(f);
  /** Filtros plegados activos (van detrás de «Más filtros»). */
  const moreActive = moreActiveCount(f);

  return (
    <div className="flex flex-col gap-3">
      <div className={`panel filters flex flex-col gap-3 p-3 ${filtersOpen ? "is-open" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="searchfield" style={{ flex: "1 1 240px", maxWidth: 360 }}>
            <input
              className="input"
              placeholder={t(
                "Nombre o tipo, en cualquier idioma…",
                "Name or type, in any language…",
              )}
              aria-label={t("Buscar en la colección", "Search the collection")}
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
            />
            {loading && <span className="inputspin" aria-hidden="true" />}
          </div>
          <button
            type="button"
            className="btn filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {moreActive > 0
              ? `${t("Más filtros", "More filters")} · ${moreActive}`
              : t("Más filtros", "More filters")}
          </button>
          <div
            className="filters-extra flex flex-wrap items-center gap-1"
            role="group"
            aria-label={t("Colores", "Colors")}
          >
            {COLORS.map((c) => {
              const on = f.colors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  title={colorLabel(c, t)}
                  aria-label={colorLabel(c, t)}
                  className="grid place-items-center rounded-full"
                  style={{
                    width: 30,
                    height: 30,
                    border: `1px solid ${on ? "var(--color-text-2)" : "transparent"}`,
                    background: on ? "var(--color-hover)" : "transparent",
                    opacity: on || f.colors.length === 0 ? 1 : 0.45,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    set({ colors: on ? f.colors.filter((x) => x !== c) : [...f.colors, c] })
                  }
                >
                  <img src={`${SYMBOL_URL}${c}.svg`} alt="" width={20} height={20} />
                </button>
              );
            })}
            <select
              className="select"
              style={{ width: "auto" }}
              aria-label={t("Cómo combinar los colores", "How to combine the colors")}
              value={f.colorMode}
              onChange={(e) => set({ colorMode: e.target.value as ColorMode })}
            >
              <option value="alguno">{t("Con alguno", "Any of them")}</option>
              <option value="dentro">{t("Dentro de la identidad", "Within the identity")}</option>
              <option value="exacto">{t("Exactamente", "Exactly")}</option>
            </select>
          </div>
        </div>
        <div className="filters-extra filters-more flex flex-col gap-3">
          <CollectionMoreFilters
            f={f}
            set={set}
            sets={facets.sets}
            copyFilters={loggedIn || Boolean(username)}
            mine={loggedIn && !username}
          />
          {active && (
            <div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => set({ ...EMPTY, sort: f.sort, dir: f.dir })}
              >
                {t("Quitar filtros", "Clear filters")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="stack-sm flex flex-wrap items-center justify-between gap-2">
        <span className="muted text-[13px]">
          <b className="mono" style={{ color: "var(--color-text)" }}>
            {n(total?.cards ?? 0)}
          </b>{" "}
          {total?.cards === 1 ? t("carta", "card") : t("cartas", "cards")} · {n(copies)}{" "}
          {t("copias", "copies")}
          {value > 0 && (
            <>
              {" "}
              · {t("aprox.", "approx.")} {eur(value)}
            </>
          )}
          {loading && items !== null && (
            <> · {f.q ? t("Buscando…", "Searching…") : t("Actualizando…", "Updating…")}</>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label={t("Ordenar", "Sort")}
            value={f.sort}
            onChange={(e) => set({ sort: e.target.value as Sort, dir: null })}
          >
            <option value="nombre">{t("Ordenar: nombre", "Sort: name")}</option>
            <option value="coste">{t("Ordenar: coste", "Sort: mana value")}</option>
            <option value="copias">{t("Ordenar: copias", "Sort: copies")}</option>
            <option value="valor">
              {t("Ordenar: valor de tus copias", "Sort: value of your copies")}
            </option>
            <option value="precio">{t("Ordenar: precio por copia", "Sort: price per copy")}</option>
            {loggedIn && (
              <option value="recientes">{t("Ordenar: recientes", "Sort: recent")}</option>
            )}
          </select>
          <SortDirButton
            dir={f.dir ?? COLLECTION_SORT_DEFAULT_DIR[f.sort]}
            onChange={(dir) =>
              set({ dir: dir === COLLECTION_SORT_DEFAULT_DIR[f.sort] ? null : dir })
            }
          />
          <div className="btn-group" role="group" aria-label={t("Ver como", "View as")}>
            {(["cuadricula", "tabla"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`btn ${view === v ? "is-on" : ""}`}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === "cuadricula" ? t("Cuadrícula", "Grid") : t("Tabla", "Table")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && items !== null && (
        <div
          className="progress"
          role="status"
          aria-label={f.q ? t("Buscando", "Searching") : t("Actualizando", "Updating")}
        >
          <i />
        </div>
      )}
      {error ? (
        <Banner tone="out">{error}</Banner>
      ) : items === null ? (
        <CardGridSkeleton label={t("Cargando tu colección…", "Loading your collection…")} />
      ) : shown.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2.5 px-5 py-9 text-center">
          <span className="muted text-[13px]">
            {t(
              "Ninguna carta de tu colección cumple esos filtros.",
              "No card in your collection matches those filters.",
            )}
          </span>
          <button type="button" className="btn" onClick={() => set({ ...EMPTY, sort: f.sort })}>
            {t("Quitar filtros", "Clear filters")}
          </button>
        </div>
      ) : view === "cuadricula" ? (
        <div className="results ctiles" aria-busy={loading}>
          {shown.map((c) => (
            <figure key={c.key} className="ctile">
              <div className="relative">
                {editable ? (
                  <button
                    type="button"
                    className="cardbtn"
                    title={t("Ver y editar tus copias", "See and edit your copies")}
                    onClick={() => setEditCard(c.card)}
                  >
                    <CardImage card={c.card} sizes="(max-width: 760px) 30vw, 180px" />
                  </button>
                ) : (
                  <CardImage card={c.card} sizes="(max-width: 760px) 30vw, 180px" />
                )}
                <span className="qtymark" title={t(`${c.quantity} copias`, `${c.quantity} copies`)}>
                  ×{c.quantity}
                </span>
              </div>
              <figcaption className="ctile-body">
                <SetLine card={c} />
                <SinceAdded card={c} />
                <div className="ctile-foot">
                  <div className="ctile-pills">
                    {c.foilQuantity > 0 && (
                      <span className="pill pill-foil">foil {c.foilQuantity}</span>
                    )}
                    <LanguagePills card={c} />
                    {c.inUse > 0 && (
                      <span className="pill" title={c.usedIn.join(", ")}>
                        <span className="dot dot-inuse" />
                        {c.inUse >= c.quantity
                          ? t("todas en mazos", "all in decks")
                          : t(`${c.inUse} en mazos`, `${c.inUse} in decks`)}
                      </span>
                    )}
                  </div>
                  {(c.value ?? c.price) !== null ? (
                    <button
                      type="button"
                      className="linkbtn mono ctile-price"
                      title={tileTitle(c, t, locale)}
                      onClick={() => setPriceCard(c.card)}
                    >
                      {eur(unitPrice(c) ?? 0)}
                    </button>
                  ) : (
                    <span
                      className="mono subtle ctile-price"
                      title={t("Sin precio de referencia", "No reference price")}
                    >
                      —
                    </span>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="results panel overflow-x-auto" aria-busy={loading}>
          <table className="table rtable">
            <thead>
              <tr>
                <th className="r" style={{ width: 44 }}>
                  {t("Copias", "Copies")}
                </th>
                <th>{t("Carta", "Card")}</th>
                <th>{t("Coste", "Cost")}</th>
                <th className="hide-sm">{t("Tipo", "Type")}</th>
                <th className="hide-sm">{t("Rol", "Role")}</th>
                <th className="hide-sm">{t("Ediciones", "Printings")}</th>
                {loggedIn && <th className="hide-sm">{t("En mazos", "In decks")}</th>}
                <th className="r">{t("Valor", "Value")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.card.oracleId}>
                  <td className="r mono rt-qty">{c.quantity}</td>
                  <td className="rt-main">
                    <CardHover card={c.card} className="inline-flex items-center gap-2">
                      {editable ? (
                        <button
                          type="button"
                          className="linkbtn"
                          title={t("Ver y editar tus copias", "See and edit your copies")}
                          onClick={() => setEditCard(c.card)}
                        >
                          {c.card.name}
                        </button>
                      ) : (
                        c.card.name
                      )}
                      {c.foilQuantity > 0 && <span className="pill pill-foil">foil</span>}
                      <LanguagePills card={c} />
                      {c.manual.length > 0 && (
                        <span className="pill subtle">{t("a mano", "by hand")}</span>
                      )}
                    </CardHover>
                  </td>
                  <td>
                    <ManaCost cost={c.card.manaCost} />
                  </td>
                  <td
                    className="muted hide-sm"
                    style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {front(c.card.typeLine)}
                  </td>
                  <td className="muted hide-sm">{roleLabel(c.primaryRole, locale)}</td>
                  <td className="mono subtle hide-sm">{c.sets.slice(0, 3).join(" ") || "—"}</td>
                  {loggedIn && (
                    <td className="muted hide-sm" title={c.usedIn.join(", ")}>
                      {c.inUse > 0
                        ? `${c.inUse} · ${c.usedIn[0]}${c.usedIn.length > 1 ? "…" : ""}`
                        : "—"}
                    </td>
                  )}
                  <td className="r mono rt-end">
                    {(c.value ?? c.price) !== null ? (
                      <button
                        type="button"
                        className="linkbtn"
                        title={valueTitle(c, t, locale)}
                        onClick={() => setPriceCard(c.card)}
                      >
                        {priceLabel(c, f.sort, t, locale)}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore
              ? t("Cargando…", "Loading…")
              : t(`Ver más (${n(remaining)} restantes)`, `See more (${n(remaining)} left)`)}
          </button>
        </div>
      )}
      <CardPriceDialog card={priceCard} onClose={() => setPriceCard(null)} />
      <CollectionCardDialog
        card={editCard}
        onClose={() => setEditCard(null)}
        onChanged={notifyCollectionChanged}
      />
    </div>
  );
}
