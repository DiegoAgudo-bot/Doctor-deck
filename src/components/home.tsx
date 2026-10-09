"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO, StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { IconPlus } from "./icons";
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
  archidekt: "Archidekt",
  moxfield: "Moxfield",
};

export function Home() {
  const { data, isPending } = authClient.useSession();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
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
    }
    const readLocal = () => setLocal(localCollection.get());
    readLocal();
    window.addEventListener(LOCAL_COLLECTION_EVENT, readLocal);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, readLocal);
  }, [data, isPending]);

  if (error) {
    return (
      <main className="page max-w-[1100px]">
        <Banner tone="out">{error}</Banner>
      </main>
    );
  }
  if (!status) {
    return (
      <main className="page max-w-[1100px]">
        <Loading>Cargando…</Loading>
      </main>
    );
  }

  const user = status.user;
  const collection = status.collection;
  const copies = user ? (collection?.totalCards ?? 0) : localCopies(local);
  const unique = user ? (collection?.uniqueCards ?? 0) : ownedPairs(local).length;

  return (
    <main className="page max-w-[1100px]" style={{ gap: 20 }}>
      {user ? (
        <div className="stack-sm flex items-center justify-between gap-3">
          <h1 className="h1">Hola, {user.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Link className="btn" href="/mazo?nuevo=1">
              Analizar una lista
            </Link>
            <Link className="btn btn-primary" href="/mazos/nuevo">
              <IconPlus size={14} />
              Nuevo mazo
            </Link>
          </div>
        </div>
      ) : (
        <section className="fade flex flex-col gap-3 py-2">
          <h1 className="h1" style={{ fontSize: 30, maxWidth: 640 }}>
            Mejora tus mazos de Commander con las cartas que ya tienes
          </h1>
          <p className="muted max-w-[620px]" style={{ fontSize: 15 }}>
            Pega tu lista (o un enlace de Archidekt o Moxfield) y te propongo cambios uno por uno:
            qué carta sacar y cuál meter, según las recomendaciones de EDHREC y priorizando tu
            colección de ManaBox.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link className="btn btn-primary btn-lg" href="/mazo">
              Analizar un mazo
            </Link>
            <Link className="btn btn-lg" href="/mazos/nuevo">
              Crear desde un comandante
            </Link>
            <Link className="btn btn-lg" href="/coleccion">
              Importar mi colección
            </Link>
          </div>
        </section>
      )}

      {status.catalog.cards === 0 && (
        <Banner tone="out">
          <b>El catálogo de cartas está vacío.</b>{" "}
          <span className="muted">
            Hay que descargar los datos de Scryfall en el servidor (
            <code>npm run scryfall:sync</code>).
          </span>
        </Banner>
      )}
      {copies === 0 && (
        <Banner
          tone="warn"
          action={
            <Link className="btn btn-sm" href="/coleccion">
              Importar CSV de ManaBox
            </Link>
          }
        >
          <b>No has importado tu colección.</b>{" "}
          <span className="muted">Sin ella no puedo priorizar las cartas que ya tienes.</span>
        </Banner>
      )}

      <div
        className="panel grid-1-sm grid"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <Stat
          href="/coleccion"
          label="Copias en tu colección"
          value={fmt(copies)}
          meta={user ? "En tu cuenta" : local ? "En este navegador" : "Sin importar"}
          first
        />
        <Stat
          href="/coleccion"
          label="Cartas distintas"
          value={fmt(unique)}
          meta={
            user && collection?.unmatchedRows
              ? `${fmt(collection.unmatchedRows)} filas sin emparejar`
              : "Emparejadas con Scryfall"
          }
        />
        {user ? (
          <Stat
            href="/mazos"
            label="Mazos guardados"
            value={decks ? fmt(decks.length) : "…"}
            meta="Sus cartas cuentan como en uso"
          />
        ) : (
          <Stat
            href="/registro"
            label="Mazos guardados"
            value="—"
            meta="Crea una cuenta para guardarlos"
          />
        )}
        <Stat
          label="Cartas en el catálogo"
          value={fmt(status.catalog.cards)}
          meta={`${fmt(status.catalog.printings)} impresiones`}
        />
      </div>

      {user ? (
        <section className="panel">
          <div className="panel-h">
            <span className="h2">Tus mazos</span>
            {decks && decks.length > 0 && (
              <Link href="/mazos" style={{ fontSize: 13 }}>
                Ver todos
              </Link>
            )}
          </div>
          {decks && decks.length === 0 ? (
            <p className="muted p-4 text-[13px]">
              Aún no has guardado ningún mazo. <Link href="/mazo?nuevo=1">Analiza uno</Link> y pulsa
              Guardar.
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
                            <CardImage card={d.commanderCard} style={{ width: 26 }} />
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
      ) : (
        <section
          className="grid-1-sm grid gap-3"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          {[
            [
              "1 · Tu colección",
              "Exporta el CSV desde ManaBox y súbelo. Sin cuenta se guarda solo en este navegador.",
            ],
            [
              "2 · Tu mazo",
              "Pega la lista o un enlace de Archidekt o Moxfield. Detecto el comandante y leo EDHREC.",
            ],
            [
              "3 · Los cambios",
              "Te propongo cambios 1×1 con las cartas que tienes: aceptas, descartas y exportas la lista.",
            ],
          ].map(([t, d], i) => (
            <div
              key={t}
              className="panel fade flex flex-col gap-1.5 p-3.5"
              style={{ ["--d" as string]: `${i * 60}ms` }}
            >
              <span className="h2">{t}</span>
              <span className="muted text-[13px]">{d}</span>
            </div>
          ))}
        </section>
      )}
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
