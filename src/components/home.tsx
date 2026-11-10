"use client";

import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO, StatusResponse, TradeProposalSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { ActivityFeed } from "./feed-page";
import { IconCheck, IconPlus, IconX } from "./icons";
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
import { Link, useLocale, useT } from "@/components/i18n";

/** «Primeros pasos» cerrados a mano en este navegador. */
const STEPS_HIDDEN_KEY = "deck-doctor:first-steps-hidden";

export function Home() {
  const locale = useLocale();
  const t = useT();
  const n = (x: number) => fmt(x, locale);
  const { data, isPending } = authClient.useSession();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  /** Propuestas de intercambio que me toca responder. */
  const [myTurn, setMyTurn] = useState<number | null>(null);
  /** Para «Primeros pasos»: si estoy en algún grupo (null = aún no se sabe). */
  const [inGroup, setInGroup] = useState<boolean | null>(null);
  const [stepsHidden, setStepsHidden] = useState(true);
  const [local, setLocal] = useState<LocalCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    api<StatusResponse>("/api/status")
      .then(setStatus)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError
            ? e.message
            : t("Error al cargar el estado", "Couldn't load the status"),
        ),
      );
    if (data) {
      api<SavedDeckSummaryDTO[]>("/api/decks", undefined, { silent: true })
        .then(setDecks)
        .catch(() => setDecks([]));
      api<TradeProposalSummaryDTO[]>("/api/trades/proposals", undefined, { silent: true })
        .then((p) => setMyTurn(p.filter((x) => x.myTurn).length))
        .catch(() => setMyTurn(0));
      api<unknown[]>("/api/groups", undefined, { silent: true })
        .then((g) => setInGroup(g.length > 0))
        .catch(() => setInGroup(null));
    }
    let hidden = false;
    try {
      hidden = localStorage.getItem(STEPS_HIDDEN_KEY) === "1";
    } catch {
      /* sin almacenamiento: se enseñan */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee del navegador al montar
    setStepsHidden(hidden);
    const readLocal = () => setLocal(localCollection.get());
    readLocal();
    window.addEventListener(LOCAL_COLLECTION_EVENT, readLocal);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, readLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo cambia con el idioma (recarga)
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
        <Loading>{t("Cargando…", "Loading…")}</Loading>
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
        <Landing locale={locale} />
      </main>
    );
  }
  const copies = user ? (collection?.totalCards ?? 0) : localCopies(local);
  const unique = user ? (collection?.uniqueCards ?? 0) : ownedPairs(local).length;

  const steps = [
    {
      done: copies > 0,
      title: t("Trae tu colección", "Bring your collection"),
      text: t(
        "Importa el CSV de la app donde la tengas o añade cartas a mano: así te proponemos primero las que ya tienes.",
        "Import the CSV from the app you keep it in or add cards by hand: that way we suggest the ones you already own first.",
      ),
      action: t("Importar", "Import"),
      href: "/collection",
    },
    {
      done: (decks?.length ?? 0) > 0,
      title: t("Guarda tu primer mazo", "Save your first deck"),
      text: t(
        "Créalo desde un comandante o pega tu lista, y verás qué cambiar y qué te falta.",
        "Create it from a commander or paste your list, and you'll see what to change and what you're missing.",
      ),
      action: t("Nuevo mazo", "New deck"),
      href: "/decks/new",
    },
    {
      done: inGroup === true,
      title: t("Junta a tu mesa", "Gather your table"),
      text: t(
        "Crea un grupo con tus amigos: veréis los mazos de todos, quién puede dejar cada carta y la clasificación.",
        "Create a group with your friends: you'll see everyone's decks, who can lend each card and the standings.",
      ),
      action: t("Crear un grupo", "Create a group"),
      href: "/groups",
    },
  ];
  // Hasta saber cómo está todo no se enseña (no debe aparecer y desaparecer al cargar).
  const showSteps =
    Boolean(user) &&
    !stepsHidden &&
    decks !== null &&
    inGroup !== null &&
    steps.some((s) => !s.done);

  return (
    <main className="page" style={{ gap: 20 }}>
      <div className="stack-sm flex items-center justify-between gap-3">
        <h1 className="h1">
          {t("Hola,", "Hi,")} {user?.name}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href="/decks/new">
            <IconPlus size={14} />
            {t("Nuevo mazo", "New deck")}
          </Link>
        </div>
      </div>

      {status.catalog.cards === 0 && (
        <Banner tone="out">
          <b>{t("El catálogo de cartas está vacío.", "The card catalog is empty.")}</b>{" "}
          <span className="muted">
            {t(
              "Hay que descargar los datos de cartas en el servidor",
              "The card data has to be downloaded on the server",
            )}{" "}
            (<code>npm run scryfall:sync</code>).
          </span>
        </Banner>
      )}
      {showSteps && (
        <section className="panel" aria-labelledby="first-steps">
          <div className="panel-h">
            <span className="h2" id="first-steps">
              {t("Primeros pasos", "Getting started")}{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {steps.filter((s) => s.done).length}/{steps.length}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label={t("Ocultar los primeros pasos", "Hide getting started")}
              onClick={() => {
                setStepsHidden(true);
                try {
                  localStorage.setItem(STEPS_HIDDEN_KEY, "1");
                } catch {
                  /* sin almacenamiento: se oculta hasta recargar */
                }
              }}
            >
              <IconX size={14} />
            </button>
          </div>
          <ol className="firststeps">
            {steps.map((s, i) => (
              <li key={s.href} className={s.done ? "is-done" : ""}>
                <span className="step-n" aria-hidden="true">
                  {s.done ? <IconCheck size={13} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="step-t">{s.title}</b>
                  {!s.done && <span className="muted text-[13px]">{s.text}</span>}
                </span>
                {!s.done && (
                  <Link className="btn btn-sm" href={s.href}>
                    {s.action}
                  </Link>
                )}
                {s.done && <span className="sr-only">{t("Hecho", "Done")}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {copies === 0 && !showSteps && (
        <Banner
          tone="warn"
          action={
            <Link className="btn btn-sm" href="/collection">
              {t("Importar mi colección", "Import my collection")}
            </Link>
          }
        >
          <b>{t("No has importado tu colección.", "You haven't imported your collection.")}</b>{" "}
          <span className="muted">
            {t(
              "Sin ella no puedo priorizar las cartas que ya tienes.",
              "Without it I can't prioritize the cards you already own.",
            )}
          </span>
        </Banner>
      )}

      <div
        className="panel grid-1-sm grid"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <Stat
          href="/collection"
          label={t("Tu colección", "Your collection")}
          value={`${n(copies)} ${copies === 1 ? t("copia", "copy") : t("copias", "copies")}`}
          meta={
            user && collection?.unmatchedRows
              ? t(
                  `${n(unique)} distintas · ${n(collection.unmatchedRows)} filas sin emparejar`,
                  `${n(unique)} unique · ${n(collection.unmatchedRows)} unmatched rows`,
                )
              : t(`${n(unique)} cartas distintas`, `${n(unique)} unique cards`)
          }
        />
        <Stat
          href="/decks"
          label={t("Mazos guardados", "Saved decks")}
          value={decks ? n(decks.length) : "…"}
          meta={t("Sus cartas cuentan como en uso", "Their cards count as in use")}
        />
        <Stat
          href={myTurn ? "/trades?tab=proposals" : "/trades"}
          label={t("Intercambios", "Trades")}
          value={myTurn === null ? "…" : n(myTurn)}
          meta={
            myTurn
              ? t("Propuestas por responder", "Proposals to answer")
              : t("Ver cruces con otros jugadores", "See matches with other players")
          }
        />
      </div>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">{t("Tus mazos", "Your decks")}</span>
          {decks && decks.length > 0 && (
            <Link href="/decks" style={{ fontSize: 13 }}>
              {t("Ver todos", "See all")}
            </Link>
          )}
        </div>
        {decks && decks.length === 0 ? (
          <p className="muted p-4 text-[13px]">
            {t("Aún no tienes ningún mazo.", "You don't have any decks yet.")}{" "}
            <Link href="/decks/new">{t("Crea uno", "Create one")}</Link>{" "}
            {t("desde un comandante o importa una lista.", "from a commander or import a list.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Mazo", "Deck")}</th>
                  <th className="hide-sm">{t("Colores", "Colors")}</th>
                  <th className="r hide-sm">{t("Cartas", "Cards")}</th>
                  <th className="hide-sm">{t("Origen", "Source")}</th>
                  <th className="r">{t("Actualizado", "Updated")}</th>
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
                    <td className="muted hide-sm">
                      {d.source === "text" ? t("texto", "text") : t("enlace", "link")}
                    </td>
                    <td className="r mono subtle">{ago(d.updatedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="h2">{t("Actividad", "Activity")}</span>
          <Link href="/feed" style={{ fontSize: 13 }}>
            {t("Ver todo", "See all")}
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
}: {
  label: string;
  value: string;
  meta: string;
  href?: string;
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
    color: "inherit",
    textDecoration: "none",
  };
  return href ? (
    <Link href={href} className="home-stat" style={style}>
      {body}
    </Link>
  ) : (
    <div className="home-stat" style={style}>
      {body}
    </div>
  );
}
