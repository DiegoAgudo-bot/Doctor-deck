"use client";

import { useEffect, useState } from "react";
import type { CommunitySort } from "@/domain/community/rank";
import type { CommunityDeckDTO, CommunityResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { DeckTile } from "./deck-tile";
import { localCollection, ownedPairs } from "./local-collection";
import { ColorPips } from "./mana";
import { useT } from "./i18n";
import { Banner, EmptyState, TilesSkeleton, useFormat } from "./ui";

const PAGE = 24;
const COLORS = ["W", "U", "B", "R", "G"] as const;
const COLOR_NAME: Record<string, [string, string]> = {
  W: ["Blanco", "White"],
  U: ["Azul", "Blue"],
  B: ["Negro", "Black"],
  R: ["Rojo", "Red"],
  G: ["Verde", "Green"],
  C: ["Incoloro", "Colorless"],
};
const SORTS: [CommunitySort, string, string][] = [
  ["recent", "Recientes", "Newest"],
  ["owned", "Los que más tengo", "Most owned"],
  ["likes", "Más gustados", "Most liked"],
];

/**
 * Comunidad: mazos públicos con filtros (texto, colores exactos, bracket, gente que sigo) y, en
 * cada uno, cuánto tienes ya y cuánto costaría lo que falta.
 */
export function CommunityDecks() {
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const t = useT();
  const { fmt } = useFormat();
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

  // ?q= (p. ej. desde la ficha de una carta) y ?sort= (desde la colección: «los que más tengo»).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras montar
    if (initial) setQ(initial.slice(0, 100));
    const s = params.get("sort");
    if (s === "recent" || s === "likes" || s === "owned") setSort(s);
  }, []);

  // El texto se busca con un pequeño respiro.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(timer);
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
          !cancelled &&
          setError(e instanceof ApiError ? e.message : t("Error al cargar", "Couldn't load")),
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
      setError(e instanceof ApiError ? e.message : t("Error al cargar", "Couldn't load"));
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
          {t("Mazos", "Decks")}{" "}
          {items !== null && (
            <span className="mono subtle" style={{ fontWeight: 400 }}>
              {fmt(total)}
            </span>
          )}
        </h2>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="muted">{t("Ordenar", "Sort")}</span>
          <select
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value as CommunitySort)}
          >
            {SORTS.map(([v, es, en]) => (
              <option key={v} value={v}>
                {t(es, en)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel flex flex-col gap-3 p-3">
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder={t("Comandante o nombre del mazo…", "Commander or deck name…")}
          aria-label={t("Buscar mazos", "Search decks")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div
            className="chips"
            role="group"
            aria-label={t("Colores (identidad exacta)", "Colors (exact identity)")}
          >
            {[...COLORS, "C"].map((c) => {
              const on = c === "C" ? colors === "C" : (colors ?? "").includes(c) && colors !== "C";
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  className={`chipbtn ${on ? "is-on" : ""}`}
                  onClick={() => toggleColor(c)}
                  aria-label={t(...COLOR_NAME[c]!)}
                  title={t(...COLOR_NAME[c]!)}
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
                {b === null ? t("Cualquier bracket", "Any bracket") : `Bracket ${b}`}
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
              {t("Solo gente que sigo", "Only people I follow")}
            </label>
          )}
        </div>
        <p className="subtle text-xs">
          {t(
            "Los colores filtran por la identidad exacta del comandante. El porcentaje es lo que ya tienes libre en tu colección",
            "Colors filter by the commander's exact identity. The percentage is what you already have free in your collection",
          )}
          {loggedIn
            ? t(
                " (sin contar lo que usan tus otros mazos)",
                " (not counting what your other decks use)",
              )
            : ""}
          .
        </p>
      </div>

      {error && <Banner tone="out">{error}</Banner>}
      {items === null ? (
        <TilesSkeleton label={t("Cargando mazos…", "Loading decks…")} />
      ) : items.length === 0 ? (
        <div className="panel">
          <EmptyState
            title={
              filtered
                ? t("Ningún mazo con esos filtros", "No decks match those filters")
                : t("Aún no hay mazos públicos", "No public decks yet")
            }
          >
            {filtered
              ? t("Prueba a quitar algún filtro.", "Try removing a filter.")
              : t(
                  "Guarda uno de los tuyos y será el primero.",
                  "Save one of yours and it'll be the first.",
                )}
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
              {loadingMore
                ? t("Cargando…", "Loading…")
                : `${t("Ver más", "Show more")} (${fmt(total - items.length)})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
