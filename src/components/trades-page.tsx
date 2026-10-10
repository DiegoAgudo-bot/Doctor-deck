"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type {
  CardDTO,
  MyProfileDTO,
  MyTradesDTO,
  TradeCardDTO,
  TradePartnerDTO,
} from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover } from "./card-image";
import { CardSearch } from "./card-search";
import { IconX } from "./icons";
import { Banner, EmptyState, Loading, fmt } from "./ui";

type Tab = "cruces" | "busco" | "cambio";

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
            {i.price !== null ? formatEuros(i.price * i.quantity) : "—"}
          </span>
          {action?.(i)}
        </li>
      ))}
    </ul>
  );
}

/** Un jugador con el que cruzo: lo que tiene que quiero y lo que quiere que tengo. */
export function PartnerCard({ p }: { p: TradePartnerDTO }) {
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="flex items-center gap-2">
          <Link className="h2" href={`/u/${p.profile.username}`}>
            @{p.profile.username}
          </Link>
          {p.following && <span className="pill subtle">le sigues</span>}
        </span>
        <span className="subtle text-xs">{p.profile.name}</span>
      </div>
      <div
        className="grid-1-sm grid gap-4 p-3.5"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <div className="flex flex-col gap-2">
          <span className="cap">
            Tiene lo que buscas
            {p.haveValue > 0 && <span className="mono"> · ≈ {formatEuros(p.haveValue)}</span>}
          </span>
          <TradeCardList items={p.theyHave} empty="Nada de tu lista de deseos." />
        </div>
        <div className="flex flex-col gap-2">
          <span className="cap">
            Busca lo que te sobra
            {p.wantValue > 0 && <span className="mono"> · ≈ {formatEuros(p.wantValue)}</span>}
          </span>
          <TradeCardList items={p.theyWant} empty="Nada de lo que tienes para cambiar." />
        </div>
      </div>
    </section>
  );
}

/**
 * /intercambios: con quién cruzo (quién tiene lo que busco y busca lo que me sobra), mi lista de
 * deseos (a mano y lo que falta de los mazos que elija) y mis cartas para cambiar (copias libres).
 * Sin pagos ni mensajes: cada uno se contacta por fuera.
 */
export function TradesPage() {
  const [tab, setTab] = useState<Tab>("cruces");
  const [mine, setMine] = useState<MyTradesDTO | null>(null);
  const [partners, setPartners] = useState<TradePartnerDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api<MyTradesDTO>("/api/trades"),
        api<TradePartnerDTO[]>("/api/trades/matches"),
      ]);
      setMine(m);
      setPartners(p);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar tus listas");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
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

  if (!mine || !partners) {
    return (
      <main className="page max-w-[1100px]">
        <h1 className="h1">Intercambios</h1>
        {error ? <Banner tone="out">{error}</Banner> : <Loading>Cargando tus listas…</Loading>}
      </main>
    );
  }

  const wishValue = mine.wishlist.reduce((n, w) => n + (w.price ?? 0) * w.quantity, 0);
  return (
    <main className="page max-w-[1100px]" style={{ gap: 20 }}>
      <div className="flex flex-col gap-1">
        <h1 className="h1">Intercambios</h1>
        <p className="muted text-[13px]">
          Tu lista de deseos y tus cartas para cambiar, y quién de la comunidad tiene lo que buscas
          o busca lo que te sobra. Aquí no se paga ni se envía nada: habla con esa persona por
          fuera.
        </p>
      </div>
      {error && <Banner tone="out">{error}</Banner>}

      <label className="check panel p-3">
        <input
          type="checkbox"
          checked={mine.public}
          disabled={busy}
          onChange={(e) => void setPublic(e.target.checked)}
        />
        <span>
          Mis listas son públicas
          <span className="subtle block text-xs">
            {mine.public
              ? "Salen en tu perfil y en los cruces de otros jugadores. Te avisaremos cuando alguien tenga algo que buscas."
              : "Solo las ves tú. Hazlas públicas para cruzarlas con las de otros (y que ellos te encuentren)."}
          </span>
        </span>
      </label>

      <nav className="tabs" aria-label="Secciones de intercambios">
        {(
          [
            ["cruces", "Cruces", partners.length],
            ["busco", "Lo que busco", mine.wishlist.length],
            ["cambio", "Para cambiar", mine.tradelistTotal],
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
            <span className="n">{fmt(n)}</span>
          </button>
        ))}
      </nav>

      {tab === "cruces" &&
        (partners.length === 0 ? (
          <div className="panel">
            <EmptyState title="Todavía no hay cruces">
              {mine.wishlist.length === 0
                ? "Añade cartas a tu lista de deseos (o mete un mazo en ella) para ver quién las tiene."
                : "Nadie con listas públicas tiene libre lo que buscas ni busca lo que te sobra. Prueba más adelante."}
            </EmptyState>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {partners.map((p) => (
              <PartnerCard key={p.profile.username} p={p} />
            ))}
          </div>
        ))}

      {tab === "busco" && (
        <div
          className="grid-1-sm grid items-start gap-4"
          style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}
        >
          <section className="panel">
            <div className="panel-h">
              <span className="h2">Lo que busco</span>
              {wishValue > 0 && (
                <span className="mono subtle text-xs">≈ {formatEuros(wishValue)}</span>
              )}
            </div>
            <div className="flex flex-col gap-3 p-3.5">
              <div style={{ maxWidth: 380 }}>
                <CardSearch
                  id="wish-search"
                  label="Añadir una carta"
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
                empty="Tu lista de deseos está vacía."
                action={(i) => {
                  const w = mine.wishlist.find((x) => x.card.oracleId === i.card.oracleId);
                  return w && w.manual > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ width: 26, height: 26 }}
                      disabled={busy}
                      aria-label={`Quitar ${i.card.name} de la lista`}
                      title={
                        w.forDecks > 0 ? "Quitar lo añadido a mano (sigue por tus mazos)" : "Quitar"
                      }
                      onClick={() => void setWish(i.card, 0)}
                    >
                      <IconX size={12} />
                    </button>
                  ) : (
                    <span
                      className="pill subtle"
                      title="Te falta para un mazo de tu lista de deseos"
                    >
                      mazo
                    </span>
                  );
                }}
              />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h">
              <span className="h2">Mazos en la lista</span>
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              <p className="subtle text-xs">
                Lo que te falta para los mazos marcados entra solo en tu lista de deseos (contando
                lo que ya usan tus otros mazos).
              </p>
              {mine.decks.length === 0 ? (
                <p className="subtle text-[13px]">
                  No tienes mazos guardados. <Link href="/mazos/nuevo">Crea uno</Link>.
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

      {tab === "cambio" && (
        <div
          className="grid-1-sm grid items-start gap-4"
          style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}
        >
          <section className="panel">
            <div className="panel-h">
              <span className="h2">Para cambiar</span>
              <span className="subtle text-xs">
                {mine.tradelistTotal > mine.tradelist.length
                  ? `Las ${mine.tradelist.length} de más valor de ${fmt(mine.tradelistTotal)}`
                  : "Tus copias libres"}
              </span>
            </div>
            <div className="p-3.5">
              <TradeCardList
                items={mine.tradelist}
                empty="No tienes copias libres: todo lo que tienes está en tus mazos (o no has importado tu colección)."
                action={(i) => (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    title="No la cambio: sale de esta lista"
                    onClick={() => void setKeep(i.card, true)}
                  >
                    No la cambio
                  </button>
                )}
              />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h">
              <span className="h2">No las cambio</span>
            </div>
            <div className="flex flex-col gap-2 p-3.5">
              <p className="subtle text-xs">
                Para cambiar salen solas tus copias libres (las que no usa ningún mazo), sin tierras
                básicas. Las que marques aquí no salen.
              </p>
              {mine.keep.length === 0 ? (
                <p className="subtle text-[13px]">Ninguna.</p>
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
                        Sí la cambio
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
