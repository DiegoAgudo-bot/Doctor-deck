"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionFilters, CollectionSort } from "@/domain/collection/browse";
import { ROLES, type Role } from "@/domain/roles/types";
import { formatEuros } from "@/domain/suggestions/format";
import type { CollectionCardDTO, CollectionTotals, CollectionViewResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover, CardImage } from "./card-image";
import { roleLabel } from "./deck-views";
import { ManaCost } from "./mana";
import { Banner, Loading, fmt } from "./ui";

/* eslint-disable @next/next/no-img-element -- símbolos de maná de Scryfall en los filtros */

const COLORS = ["W", "U", "B", "R", "G", "C"] as const;
type ColorKey = (typeof COLORS)[number];
const COLOR_LABEL: Record<ColorKey, string> = {
  W: "Blanco",
  U: "Azul",
  B: "Negro",
  R: "Rojo",
  G: "Verde",
  C: "Incoloro",
};

const TYPES = [
  ["Creature", "Criatura"],
  ["Instant", "Instantáneo"],
  ["Sorcery", "Conjuro"],
  ["Artifact", "Artefacto"],
  ["Enchantment", "Encantamiento"],
  ["Planeswalker", "Planeswalker"],
  ["Land", "Tierra"],
  ["Battle", "Batalla"],
] as const;

type ColorMode = "alguno" | "dentro" | "exacto";
type Sort = CollectionSort;

interface Filters {
  q: string;
  colors: ColorKey[];
  colorMode: ColorMode;
  type: string;
  role: Role | "";
  cmc: number | null;
  origin: "" | "csv" | "manual";
  use: "" | "libres" | "en-mazos";
  foil: boolean;
  sort: Sort;
}

const EMPTY: Filters = {
  q: "",
  colors: [],
  colorMode: "alguno",
  type: "",
  role: "",
  cmc: null,
  origin: "",
  use: "",
  foil: false,
  sort: "nombre",
};

/** Cartas por página: la colección se pide al servidor por trozos ("Ver más"). */
const PAGE = 48;
const front = (typeLine: string) => typeLine.split("//")[0] ?? typeLine;

/** Los filtros de la interfaz, en el formato de la API (sin los vacíos). */
function toQuery(f: Filters): CollectionFilters {
  return {
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(f.colors.length > 0 ? { colors: f.colors, colorMode: f.colorMode } : {}),
    ...(f.type ? { type: f.type as CollectionFilters["type"] } : {}),
    ...(f.role ? { role: f.role } : {}),
    ...(f.cmc !== null ? { cmc: f.cmc } : {}),
    ...(f.origin ? { origin: f.origin } : {}),
    ...(f.use ? { use: f.use } : {}),
    ...(f.foil ? { foil: true } : {}),
  };
}

/**
 * Pestaña "Mis cartas": la colección agrupada por carta, con filtros, orden y dos vistas. El
 * servidor filtra, ordena y pagina; aquí solo se pide la página siguiente con "Ver más".
 * `localPairs`: sin cuenta, la colección del navegador. `version` cambia cuando la colección cambia.
 */
export function CollectionBrowser({
  loggedIn,
  localPairs,
  version,
}: {
  loggedIn: boolean;
  localPairs: [string, number][] | null;
  version: number;
}) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [view, setView] = useState<"cuadricula" | "tabla">("cuadricula");
  const [items, setItems] = useState<CollectionCardDTO[] | null>(null);
  const [total, setTotal] = useState<CollectionTotals | null>(null);
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
          ...(!loggedIn && localPairs ? { collection: localPairs } : {}),
          filters: toQuery(f),
          sort: f.sort,
          offset,
          limit: PAGE,
        }),
      }),
    [f, loggedIn, localPairs],
  );

  // Primera página al cambiar filtros u orden (con un respiro mientras se escribe en el buscador).
  useEffect(() => {
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
  }, [fetchPage, version, f.q]);

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
  const active =
    f.q !== "" ||
    f.colors.length > 0 ||
    f.type !== "" ||
    f.role !== "" ||
    f.cmc !== null ||
    f.origin !== "" ||
    f.use !== "" ||
    f.foil;

  return (
    <div className="flex flex-col gap-3">
      <div className="panel flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input"
            style={{ flex: "1 1 240px", maxWidth: 360 }}
            placeholder="Buscar por nombre o tipo…"
            aria-label="Buscar en la colección"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Colores">
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
                  <img
                    src={`https://svgs.scryfall.io/card-symbols/${c}.svg`}
                    alt=""
                    width={20}
                    height={20}
                  />
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
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Tipo"
            value={f.type}
            onChange={(e) => set({ type: e.target.value })}
          >
            <option value="">Todos los tipos</option>
            {TYPES.map(([en, es]) => (
              <option key={en} value={en}>
                {es}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Rol"
            value={f.role}
            onChange={(e) => set({ role: e.target.value as Role | "" })}
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="Coste de maná"
            value={f.cmc ?? ""}
            onChange={(e) => set({ cmc: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">Cualquier coste</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                Coste {n === 7 ? "7+" : n}
              </option>
            ))}
          </select>
          {loggedIn && (
            <>
              <select
                className="select"
                style={{ width: "auto" }}
                aria-label="Origen"
                value={f.origin}
                onChange={(e) => set({ origin: e.target.value as Filters["origin"] })}
              >
                <option value="">CSV y a mano</option>
                <option value="csv">Del CSV</option>
                <option value="manual">Añadidas a mano</option>
              </select>
              <select
                className="select"
                style={{ width: "auto" }}
                aria-label="Uso en mazos"
                value={f.use}
                onChange={(e) => set({ use: e.target.value as Filters["use"] })}
              >
                <option value="">Usadas o no</option>
                <option value="libres">Con copias libres</option>
                <option value="en-mazos">En algún mazo</option>
              </select>
              <label className="check" style={{ alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={f.foil}
                  onChange={(e) => set({ foil: e.target.checked })}
                  style={{ marginTop: 0 }}
                />
                Solo foil
              </label>
            </>
          )}
          {active && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => set({ ...EMPTY, sort: f.sort })}
            >
              Quitar filtros
            </button>
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
            onChange={(e) => set({ sort: e.target.value as Sort })}
          >
            <option value="nombre">Ordenar: nombre</option>
            <option value="coste">Ordenar: coste</option>
            <option value="copias">Ordenar: copias</option>
            <option value="precio">Ordenar: precio</option>
            {loggedIn && <option value="recientes">Ordenar: recientes</option>}
          </select>
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
        <Loading>Cargando tu colección…</Loading>
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
                <CardImage card={c.card} />
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
                  <span className="pill pill-warn">foil {c.foilQuantity}</span>
                )}
                {c.inUse > 0 && (
                  <span className="pill" title={c.usedIn.join(", ")}>
                    <span className="dot dot-inuse" />
                    {c.inUse >= c.quantity ? "todas en mazos" : `${c.inUse} en mazos`}
                  </span>
                )}
                {c.price !== null && (
                  <span className="mono subtle ml-auto">{formatEuros(c.price)}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
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
                <th className="r">Precio</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.card.oracleId}>
                  <td className="r mono">{c.quantity}</td>
                  <td>
                    <CardHover card={c.card} className="inline-flex items-center gap-2">
                      {c.card.name}
                      {c.foilQuantity > 0 && <span className="pill pill-warn">foil</span>}
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
                  <td className="r mono">{c.price !== null ? formatEuros(c.price) : "—"}</td>
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
    </div>
  );
}
