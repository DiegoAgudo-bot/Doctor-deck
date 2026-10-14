"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO, StatusResponse, TradeProposalSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { ActivityFeed } from "./feed-page";
import { IconPlus } from "./icons";
import { Landing } from "./landing";
import {
  LOCAL_COLLECTION_EVENT,
  localCollection,
  localCopies,
  ownedPairs,
  type LocalCollection,
} from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Loading, ago, fmt } from "./ui";

const SOURCE: Record<string, string> = {
  text: "texto",
  archidekt: "enlace",
  moxfield: "enlace",
};

export function Home() {
  const { data, isPending } = authClient.useSession();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  /** Propuestas de intercambio que me toca responder. */
  const [myTurn, setMyTurn] = useState<number | null>(null);
  const [local, setLocal] = useState<LocalCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    api<StatusResponse>("/api/status")
      .then(setStatus)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Error al cargar el estado"),
      );
    if (data) {
      api<SavedDeckSummaryDTO[]>("/api/decks", undefined, { silent: true })
        .then(setDecks)
        .catch(() => setDecks([]));
      api<TradeProposalSummaryDTO[]>("/api/trades/proposals", undefined, { silent: true })
        .then((p) => setMyTurn(p.filter((x) => x.myTurn).length))
        .catch(() => setMyTurn(0));
    }
    const readLocal = () => setLocal(localCollection.get());
    readLocal();
    window.addEventListener(LOCAL_COLLECTION_EVENT, readLocal);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, readLocal);
  }, [data, isPending]);

  if (error) {
    return (
      <main className="page">
        <Banner tone="out">{error}</Banner>
      </main>
    );
  }
  if (!status) {
    return (
      <main className="page">
        <Loading>Cargando…</Loading>
      </main>
    );
  }

  const user = status.user;
  const collection = status.collection;
  // Sin cuenta (la sesión caducó en el navegador): la portada.
  if (!user && !isPending) {
    // La portada sin sesión la pinta el servidor; esto solo pasa si la sesión caduca aquí.
    return (
      <main className="page">
        <Landing />
      </main>
    );
  }
  const copies = user ? (collection?.totalCards ?? 0) : localCopies(local);
  const unique = user ? (collection?.uniqueCards ?? 0) : ownedPairs(local).length;

  return (
    <main className="page" style={{ gap: 20 }}>
      <div className="stack-sm flex items-center justify-between gap-3">
        <h1 className="h1">Hola, {user?.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href="/decks/new">
            <IconPlus size={14} />
            Nuevo mazo
          </Link>
        </div>
      </div>

      {status.catalog.cards === 0 && (
        <Banner tone="out">
          <b>El catálogo de cartas está vacío.</b>{" "}
          <span className="muted">
            Hay que descargar los datos de cartas en el servidor (<code>npm run scryfall:sync</code>
            ).
          </span>
        </Banner>
      )}
      {copies === 0 && (
        <Banner
          tone="warn"
          action={
            <Link className="btn btn-sm" href="/collection">
              Importar mi colección
            </Link>
          }
        >
          <b>No has importado tu colección.</b>{" "}
          <span className="muted">Sin ella no puedo priorizar las cartas que ya tienes.</span>
        </Banner>
      )}

      <div
        className="panel grid-1-sm grid"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <Stat
          href="/collection"
          label="Tu colección"
          value={`${fmt(copies)} ${copies === 1 ? "copia" : "copias"}`}
          meta={
            user && collection?.unmatchedRows
              ? `${fmt(unique)} distintas · ${fmt(collection.unmatchedRows)} filas sin emparejar`
              : `${fmt(unique)} cartas distintas`
          }
          first
        />
        <Stat
          href="/decks"
          label="Mazos guardados"
          value={decks ? fmt(decks.length) : "…"}
          meta="Sus cartas cuentan como en uso"
        />
        <Stat
          href={myTurn ? "/trades?tab=proposals" : "/trades"}
          label="Intercambios"
          value={myTurn === null ? "…" : fmt(myTurn)}
          meta={myTurn ? "Propuestas por responder" : "Ver cruces con otros jugadores"}
        />
      </div>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Tus mazos</span>
          {decks && decks.length > 0 && (
            <Link href="/decks" style={{ fontSize: 13 }}>
              Ver todos
            </Link>
          )}
        </div>
        {decks && decks.length === 0 ? (
          <p className="muted p-4 text-[13px]">
            Aún no tienes ningún mazo. <Link href="/decks/new">Crea uno</Link> desde un comandante o
            importa una lista.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mazo</th>
                  <th className="hide-sm">Colores</th>
                  <th className="r hide-sm">Cartas</th>
                  <th className="hide-sm">Origen</th>
                  <th className="r">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {(decks ?? []).slice(0, 6).map((d, i) => (
                  <tr key={d.id} className="fade" style={{ ["--d" as string]: `${i * 40}ms` }}>
                    <td>
                      <Link
                        href={`/decks/${d.id}`}
                        className="flex items-center gap-2.5"
                        style={{ color: "var(--color-text)", textDecoration: "none" }}
                      >
                        {d.commanderCard ? (
                          <CardImage card={d.commanderCard} style={{ width: 26 }} sizes="26px" />
                        ) : (
                          <span className="w-[26px]" />
                        )}
                        <span className="flex flex-col leading-tight">
                          <span style={{ fontWeight: 500 }}>{d.name}</span>
                          <span className="subtle text-xs">{d.commanderNames.join(" + ")}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hide-sm">
                      <ColorPips colors={d.colorIdentity} />
                    </td>
                    <td className="r mono hide-sm">{d.cardCount}</td>
                    <td className="muted hide-sm">{SOURCE[d.source] ?? d.source}</td>
                    <td className="r mono subtle">{ago(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="h2">Actividad</span>
          <Link href="/feed" style={{ fontSize: 13 }}>
            Ver todo
          </Link>
        </div>
        <ActivityFeed compact />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  meta,
  href,
  first = false,
}: {
  label: string;
  value: string;
  meta: string;
  href?: string;
  first?: boolean;
}) {
  const body = (
    <>
      <span className="cap">{label}</span>
      <span className="mono" style={{ fontSize: 22, fontWeight: 500 }}>
        {value}
      </span>
      <span className="subtle text-xs">{meta}</span>
    </>
  );
  const style = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    padding: "14px 16px",
    borderLeft: first ? 0 : "1px solid var(--color-line)",
    color: "inherit",
    textDecoration: "none",
  };
  return href ? (
    <Link href={href} style={style}>
      {body}
    </Link>
  ) : (
    <div style={style}>{body}</div>
  );
}
