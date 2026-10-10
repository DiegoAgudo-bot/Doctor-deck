"use client";

import { useEffect, useState } from "react";
import type { CommunitySort } from "@/domain/community/rank";
import type { CommunityDeckDTO, CommunityResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { DeckTile } from "./deck-tile";
import { localCollection, ownedPairs } from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, EmptyState, Loading, fmt } from "./ui";

const PAGE = 24;
const COLORS = ["W", "U", "B", "R", "G"] as const;
const SORTS: [CommunitySort, string][] = [
  ["recent", "Recientes"],
  ["owned", "Los que más tengo"],
  ["likes", "Más gustados"],
];

/**
 * Comunidad: mazos públicos con filtros (texto, colores exactos, bracket, gente que sigo) y, en
 * cada uno, cuánto tienes ya y cuánto costaría lo que falta.
 */
export function CommunityDecks() {
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<string | null>(null);
  const [bracket, setBracket] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [sort, setSort] = useState<CommunitySort>("recent");
  const [items, setItems] = useState<CommunityDeckDTO[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El texto se busca con un pequeño respiro.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const body = (offset: number) => {
    const local = loggedIn ? null : localCollection.get();
    return JSON.stringify({
      filters: {
        ...(query ? { q: query } : {}),
        ...(colors !== null ? { colors } : {}),
        ...(bracket !== null ? { bracket } : {}),
        ...(following ? { following: true } : {}),
      },
      sort,
      offset,
      limit: PAGE,
      ...(local ? { collection: ownedPairs(local) } : {}),
    });
  };

  useEffect(() => {
    let cancelled = false;
    api<CommunityResponse>("/api/community/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body(0),
    })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
        setError(null);
      })
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof ApiError ? e.message : "Error al cargar"),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `body` depende de estos filtros
  }, [query, colors, bracket, following, sort, loggedIn]);

  async function more() {
    if (!items) return;
    setLoadingMore(true);
    try {
      const r = await api<CommunityResponse>("/api/community/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body(items.length),
      });
      setItems([...items, ...r.items]);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar");
    } finally {
      setLoadingMore(false);
    }
  }

  const toggleColor = (c: string) =>
    setColors((prev) => {
      if (c === "C") return prev === "C" ? null : "C";
      const set = new Set(prev && prev !== "C" ? prev.split("") : []);
      if (set.has(c)) set.delete(c);
      else set.add(c);
      const next = COLORS.filter((x) => set.has(x)).join("");
      return next || null;
    });
  const filtered = query !== "" || colors !== null || bracket !== null || following;

  return (
    <section className="flex flex-col gap-3">
      <div className="stack-sm flex items-end justify-between gap-3">
        <h2 className="h2" style={{ fontSize: 17 }}>
          Mazos{" "}
          {items !== null && (
            <span className="mono subtle" style={{ fontWeight: 400 }}>
              {fmt(total)}
            </span>
          )}
        </h2>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="muted">Ordenar</span>
          <select
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value as CommunitySort)}
          >
            {SORTS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel flex flex-col gap-3 p-3">
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Comandante o nombre del mazo…"
          aria-label="Buscar mazos"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="chips" role="group" aria-label="Colores (identidad exacta)">
            {[...COLORS, "C"].map((c) => {
              const on = c === "C" ? colors === "C" : (colors ?? "").includes(c) && colors !== "C";
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  className={`chipbtn ${on ? "is-on" : ""}`}
                  onClick={() => toggleColor(c)}
                  title={c === "C" ? "Incoloro" : undefined}
                >
                  <ColorPips colors={[c]} />
                </button>
              );
            })}
          </div>
          <div className="chips" role="radiogroup" aria-label="Bracket">
            {([null, 2, 3, 4] as const).map((b) => (
              <button
                key={b ?? "all"}
                type="button"
                role="radio"
                aria-checked={bracket === b}
                className={`chipbtn ${bracket === b ? "is-on" : ""}`}
                onClick={() => setBracket(b)}
              >
                {b === null ? "Cualquier bracket" : `Bracket ${b}`}
              </button>
            ))}
          </div>
          {loggedIn && (
            <label className="check text-[13px]">
              <input
                type="checkbox"
                checked={following}
                onChange={(e) => setFollowing(e.target.checked)}
              />
              Solo gente que sigo
            </label>
          )}
        </div>
        <p className="subtle text-xs">
          Los colores filtran por la identidad exacta del comandante. El porcentaje es lo que ya
          tienes libre en tu colección{loggedIn ? " (sin contar lo que usan tus otros mazos)" : ""}.
        </p>
      </div>

      {error && <Banner tone="out">{error}</Banner>}
      {items === null ? (
        <Loading>Cargando mazos…</Loading>
      ) : items.length === 0 ? (
        <div className="panel">
          <EmptyState
            title={filtered ? "Ningún mazo con esos filtros" : "Aún no hay mazos públicos"}
          >
            {filtered
              ? "Prueba a quitar algún filtro."
              : "Guarda uno de los tuyos y será el primero."}
          </EmptyState>
        </div>
      ) : (
        <>
          <div
            className="grid-1-sm grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {items.map((d, i) => (
              <DeckTile
                key={d.id}
                deck={d}
                owner={d.owner}
                ownership={d.ownership}
                likes={d.likes}
                bracket={d.bracket}
                delay={Math.min(i, 12) * 30}
              />
            ))}
          </div>
          {items.length < total && (
            <button
              type="button"
              className="btn self-center"
              disabled={loadingMore}
              onClick={() => void more()}
            >
              {loadingMore ? "Cargando…" : `Ver más (${fmt(total - items.length)})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
