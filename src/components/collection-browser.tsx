"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { languageBadge, languageLabel } from "@/domain/cards/languages";
import {
  COLLECTION_SORT_DEFAULT_DIR,
  type CollectionSort,
  unitPrice,
} from "@/domain/collection/browse";
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

/* eslint-disable @next/next/no-img-element -- símbolos de maná de Scryfall en los filtros */

const COLOR_LABEL: Record<ColorKey, string> = {
  W: "Blanco",
  U: "Azul",
  B: "Negro",
  R: "Rojo",
  G: "Verde",
  C: "Incoloro",
};

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
const valueTitle = (c: CollectionCardDTO) =>
  `${c.quantity} ${c.quantity === 1 ? "copia" : "copias"}: lo que valen según su edición y si son foil${
    c.price !== null ? ` (la más barata, ${formatEuros(c.price)} c/u)` : ""
  }. Clic para ver el histórico de precio.`;

/** Ordenando por precio, lo que vale cada copia («c/u»); si no, lo que valen todas. */
const priceLabel = (c: CollectionCardDTO, sort: Sort) =>
  sort === "precio" && c.quantity > 1
    ? `${formatEuros(unitPrice(c) ?? 0)} c/u`
    : formatEuros(c.value ?? c.price ?? 0);

/** Idiomas de las copias que no son en inglés ("ES ×2"); en inglés no se marca nada. */
function LanguagePills({ card }: { card: CollectionCardDTO }) {
  return card.languages
    .filter((l) => l.language !== "en")
    .map((l) => (
      <span
        key={l.language}
        className="pill"
        title={`${l.quantity} en ${languageLabel(l.language)}`}
      >
        {languageBadge(l.language)}
        {card.quantity > 1 ? ` ×${l.quantity}` : ""}
      </span>
    ));
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
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));

  const fetchPage = useCallback(
    (offset: number) =>
      api<CollectionViewResponse>("/api/collection/view", {
        method: "POST",
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

  useEffect(() => {
    if (!ready) return;
    const id = ++request.current;
    const t = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        fetchPage(0)
          .then((r) => {
            if (id !== request.current) return;
            setItems(r.items);
            setTotal(r.total);
            if (r.facets) setFacets(r.facets);
            if (cacheable) {
              writeCached("collection-first", { sig: signature, items: r.items, total: r.total });
            }
          })
          .catch((e: unknown) => {
            if (id === request.current) {
              setError(e instanceof ApiError ? e.message : "No se pudo cargar la colección");
            }
          })
          .finally(() => id === request.current && setLoading(false));
      },
      f.q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [fetchPage, version, f.q, ready, cacheable, signature]);

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
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar más cartas");
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
          <input
            className="input"
            style={{ flex: "1 1 240px", maxWidth: 360 }}
            placeholder="Nombre o tipo, en cualquier idioma…"
            aria-label="Buscar en la colección"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
          <button
            type="button"
            className="btn filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {moreActive > 0 ? `Más filtros · ${moreActive}` : "Más filtros"}
          </button>
          <div
            className="filters-extra flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Colores"
          >
            {COLORS.map((c) => {
              const on = f.colors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  title={COLOR_LABEL[c]}
                  aria-label={COLOR_LABEL[c]}
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
              aria-label="Cómo combinar los colores"
              value={f.colorMode}
              onChange={(e) => set({ colorMode: e.target.value as ColorMode })}
            >
              <option value="alguno">Con alguno</option>
              <option value="dentro">Dentro de la identidad</option>
              <option value="exacto">Exactamente</option>
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
                Quitar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="stack-sm flex flex-wrap items-center justify-between gap-2">
        <span className="muted text-[13px]">
          <b className="mono" style={{ color: "var(--color-text)" }}>
            {fmt(total?.cards ?? 0)}
          </b>{" "}
          {total?.cards === 1 ? "carta" : "cartas"} · {fmt(copies)} copias
          {value > 0 && <> · aprox. {formatEuros(value)}</>}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Ordenar"
            value={f.sort}
            onChange={(e) => set({ sort: e.target.value as Sort, dir: null })}
          >
            <option value="nombre">Ordenar: nombre</option>
            <option value="coste">Ordenar: coste</option>
            <option value="copias">Ordenar: copias</option>
            <option value="valor">Ordenar: valor de tus copias</option>
            <option value="precio">Ordenar: precio por copia</option>
            {loggedIn && <option value="recientes">Ordenar: recientes</option>}
          </select>
          <SortDirButton
            dir={f.dir ?? COLLECTION_SORT_DEFAULT_DIR[f.sort]}
            onChange={(dir) =>
              set({ dir: dir === COLLECTION_SORT_DEFAULT_DIR[f.sort] ? null : dir })
            }
          />
          <div className="btn-group" role="group" aria-label="Ver como">
            {(["cuadricula", "tabla"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`btn ${view === v ? "is-on" : ""}`}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === "cuadricula" ? "Cuadrícula" : "Tabla"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && items !== null && (
        <div className="progress" role="status" aria-label="Actualizando">
          <i />
        </div>
      )}
      {error ? (
        <Banner tone="out">{error}</Banner>
      ) : items === null ? (
        <CardGridSkeleton label="Cargando tu colección…" />
      ) : shown.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2.5 px-5 py-9 text-center">
          <span className="muted text-[13px]">
            Ninguna carta de tu colección cumple esos filtros.
          </span>
          <button type="button" className="btn" onClick={() => set({ ...EMPTY, sort: f.sort })}>
            Quitar filtros
          </button>
        </div>
      ) : view === "cuadricula" ? (
        <div
          className="grid gap-x-3 gap-y-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
        >
          {shown.map((c) => (
            <figure key={c.card.oracleId} className="m-0 flex flex-col gap-1.5">
              <div className="relative">
                {editable ? (
                  <button
                    type="button"
                    className="cardbtn"
                    title="Ver y editar tus copias"
                    onClick={() => setEditCard(c.card)}
                  >
                    <CardImage card={c.card} sizes="(max-width: 760px) 30vw, 180px" />
                  </button>
                ) : (
                  <CardImage card={c.card} sizes="(max-width: 760px) 30vw, 180px" />
                )}
                <span
                  className="qtymark"
                  style={{ top: "4%", right: -4 }}
                  title={`${c.quantity} copias`}
                >
                  ×{c.quantity}
                </span>
              </div>
              <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {c.foilQuantity > 0 && (
                  <span className="pill pill-foil">foil {c.foilQuantity}</span>
                )}
                <LanguagePills card={c} />
                {c.inUse > 0 && (
                  <span className="pill" title={c.usedIn.join(", ")}>
                    <span className="dot dot-inuse" />
                    {c.inUse >= c.quantity ? "todas en mazos" : `${c.inUse} en mazos`}
                  </span>
                )}
                {(c.value ?? c.price) !== null && (
                  <button
                    type="button"
                    className="linkbtn mono subtle ml-auto"
                    title={valueTitle(c)}
                    onClick={() => setPriceCard(c.card)}
                  >
                    {priceLabel(c, f.sort)}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table rtable">
            <thead>
              <tr>
                <th className="r" style={{ width: 44 }}>
                  Copias
                </th>
                <th>Carta</th>
                <th>Coste</th>
                <th className="hide-sm">Tipo</th>
                <th className="hide-sm">Rol</th>
                <th className="hide-sm">Ediciones</th>
                {loggedIn && <th className="hide-sm">En mazos</th>}
                <th className="r">Valor</th>
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
                          title="Ver y editar tus copias"
                          onClick={() => setEditCard(c.card)}
                        >
                          {c.card.name}
                        </button>
                      ) : (
                        c.card.name
                      )}
                      {c.foilQuantity > 0 && <span className="pill pill-foil">foil</span>}
                      <LanguagePills card={c} />
                      {c.manual.length > 0 && <span className="pill subtle">a mano</span>}
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
                  <td className="muted hide-sm">{roleLabel(c.primaryRole)}</td>
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
                        title={valueTitle(c)}
                        onClick={() => setPriceCard(c.card)}
                      >
                        {priceLabel(c, f.sort)}
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
            {loadingMore ? "Cargando…" : `Ver más (${fmt(remaining)} restantes)`}
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
