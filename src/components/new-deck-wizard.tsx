"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COLORS } from "@/domain/cards/types";
import { suggestedDeckName } from "@/domain/deck/naming";
import type { DeckVisibility } from "@/domain/deck/visibility";
import type { CardDetailDTO } from "@/server/card-dto";
import type {
  CardDTO,
  CollectionViewResponse,
  CommanderInfoDTO,
  NewDeckResponse,
} from "@/server/dto";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { VisibilityPicker } from "./deck-visibility";
import { IconX } from "./icons";
import { localCollection, notifyDecksChanged, ownedPairs } from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Loading, fmt } from "./ui";

type Mode = "average" | "owned" | "empty";
/** De dónde sale el mazo: el comandante (mazo medio o vacío) o una lista/enlace que ya tengo. */
type Source = "commander" | "list";

const isLink = (s: string) => /^\s*https?:\/\//i.test(s);
const LIST_PLACEHOLDER =
  "Pega la lista (Commander / Deck, una carta por línea) o el enlace de un mazo público";

/** Deja la lista en el navegador y la abre en el analizador (sin cuenta, o para elegir comandante). */
function openInAnalyzer(input: string, name: string, tab: string) {
  storage.set("deck-doctor:mazo", {
    input,
    theme: "",
    name,
    locked: [],
    excluded: [],
    deckId: null,
    useOtherDecks: true,
    visibility: "public",
  });
  window.location.assign(new URL(`/analyze?analyze=1&tab=${tab}`, window.location.origin));
}

const shortName = (name: string) => name.split(/,| \/\/ /)[0] ?? name;
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString("es", { maximumFractionDigits: 1 })}K` : String(n);

/**
 * /decks/new: crear un mazo eligiendo el comandante (el mazo medio de EDHREC, general o de un
 * tema, o vacío para montarlo desde cero) o importando una lista. El nombre se propone solo:
 * "<colores> - <de qué va>".
 */
export function NewDeckWizard() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [commanders, setCommanders] = useState<CardDTO[]>([]);
  const [pairing, setPairing] = useState(false);
  const [info, setInfo] = useState<CommanderInfoDTO | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [mode, setMode] = useState<Mode>("average");
  const [theme, setTheme] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [visibility, setVisibility] = useState<DeckVisibility>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("commander");
  const [list, setList] = useState("");
  /** Cartas de mi colección que pueden ser comandante (atajos del paso 1). */
  const [mine, setMine] = useState<CardDTO[] | null>(null);
  /** Sin cuenta, si hay colección en este navegador (para «Con mis cartas»). */
  const [hasLocal, setHasLocal] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage, tras montar
    setHasLocal(localCollection.get() !== null);
  }, []);
  const hasCollection = loggedIn || hasLocal;

  // ?from=list: abrir en «Importar una lista».
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras montar
    if (new URLSearchParams(window.location.search).get("from") === "list") setSource("list");
  }, []);

  // Tus comandantes: los que tengo en la colección (la de la cuenta o la del navegador).
  useEffect(() => {
    const local = loggedIn ? null : localCollection.get();
    if (!loggedIn && !local) return;
    api<CollectionViewResponse>(
      "/api/collection/view",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { commander: true },
          sort: "copias",
          offset: 0,
          limit: 12,
          ...(local ? { collection: ownedPairs(local) } : {}),
        }),
      },
      { silent: true },
    )
      .then((r) => setMine(r.items.map((i) => i.card)))
      .catch(() => setMine([]));
  }, [loggedIn]);

  // ?commander={oracleId} (botón "Crear mazo" de la ficha de una carta): ya elegido.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("commander");
    if (!id) return;
    api<CardDetailDTO>(`/api/cards/${encodeURIComponent(id)}`, undefined, { silent: true })
      .then((d) => d.commander && setCommanders([d.card]))
      .catch(() => undefined);
  }, []);

  // Al cambiar de comandante(s): sus temas en EDHREC.
  const ids = commanders.map((c) => c.oracleId).join(",");
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al elegir comandante
    setLoadingInfo(true);
    setError(null);
    api<CommanderInfoDTO>(`/api/commanders?ids=${encodeURIComponent(ids)}`)
      .then((i) => !cancelled && setInfo(i))
      .catch((e: unknown) => {
        if (cancelled) return;
        setInfo(null);
        setError(e instanceof ApiError ? e.message : "No se pudieron cargar los temas");
      })
      .finally(() => !cancelled && setLoadingInfo(false));
    return () => {
      cancelled = true;
    };
  }, [ids]);

  // Nombre propuesto: "<colores> - <tema elegido o los dos más jugados>" (o el comandante, vacío).
  const chosenTheme = info?.themes.find((t) => t.slug === theme);
  const proposed =
    commanders.length === 0
      ? ""
      : suggestedDeckName(
          COLORS.filter((c) => commanders.some((x) => x.colorIdentity.includes(c))),
          mode === "empty"
            ? []
            : chosenTheme
              ? [chosenTheme.name]
              : (info?.themes ?? []).map((t) => t.name),
          shortName(commanders[0]?.name ?? ""),
        );
  const finalName = nameTouched ? name : proposed;

  function pick(card: CardDTO) {
    setCommanders((prev) => (pairing ? [...prev.slice(0, 1), card] : [card]));
    setPairing(false);
    setTheme("");
    setNameTouched(false);
  }

  /** Importar: con cuenta se guarda y se abre; sin ella (o sin comandante claro), al analizador. */
  async function createFromList() {
    const input = list.trim();
    if (!input) return;
    if (!loggedIn) return openInAnalyzer(input, name.trim(), "changes");
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string; name: string }>("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          ...(name.trim() ? { name: name.trim() } : {}),
          visibility,
        }),
      });
      notifyDecksChanged();
      router.push(`/decks/${res.id}`);
    } catch (e) {
      // La lista no dice cuál es el comandante: se elige en el analizador y luego se guarda.
      if (e instanceof ApiError && e.code === "no_commander") {
        return openInAnalyzer(input, name.trim(), "changes");
      }
      setError(e instanceof ApiError ? e.message : "No se pudo importar la lista");
      setBusy(false);
    }
  }

  async function create() {
    if (commanders.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<NewDeckResponse>("/api/decks/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commanderIds: commanders.map((c) => c.oracleId),
          mode,
          ...(mode !== "empty" && theme ? { theme } : {}),
          // Sin cuenta, «con mis cartas» usa la colección del navegador.
          ...(mode === "owned" && !loggedIn
            ? { collection: ownedPairs(localCollection.get()) }
            : {}),
          ...(finalName.trim() ? { name: finalName.trim() } : {}),
          visibility,
        }),
      });
      const tab = mode === "empty" ? "list&edit=1" : mode === "owned" ? "list" : "missing";
      if (res.saved && res.id) {
        notifyDecksChanged();
        router.push(`/decks/${res.id}?tab=${tab}`);
      } else {
        // Sin cuenta: se abre en el analizador (el mazo queda en este navegador).
        storage.set("deck-doctor:mazo", {
          input: res.input,
          theme: res.theme ?? "",
          name: res.name,
          locked: [],
          excluded: [],
          deckId: null,
          useOtherDecks: true,
          visibility: "public",
        });
        router.push(`/analyze?analyze=1&tab=${tab}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo crear el mazo");
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ gap: 20 }}>
      <div className="flex flex-col gap-1">
        <h1 className="h1">Nuevo mazo</h1>
        <p className="muted text-[13px]">
          Elige el comandante y te monto el mazo con lo que juega la comunidad (o empiezas desde
          cero), o importa una lista que ya tengas.
        </p>
      </div>

      <nav className="tabs" aria-label="Cómo empiezas">
        {(
          [
            ["commander", "Desde un comandante"],
            ["list", "Importar una lista o enlace"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={source === id ? "is-active" : ""}
            aria-pressed={source === id}
            onClick={() => {
              setSource(id);
              setError(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {source === "list" && (
        <section className="panel">
          <form
            className="flex flex-col gap-3.5 p-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void createFromList();
            }}
          >
            <div className="field">
              <label className="label" htmlFor="import-list">
                Lista o enlace
              </label>
              {isLink(list) ? (
                <input
                  id="import-list"
                  className="input mono"
                  type="url"
                  value={list}
                  onChange={(e) => setList(e.target.value)}
                />
              ) : (
                <textarea
                  id="import-list"
                  className="textarea"
                  spellCheck={false}
                  value={list}
                  placeholder={LIST_PLACEHOLDER}
                  onChange={(e) => setList(e.target.value)}
                />
              )}
              <span className="hint">
                Formatos: <span className="mono">1 Sol Ring</span>,{" "}
                <span className="mono">1x Sol Ring (C21) 263</span>, secciones Commander/Deck o{" "}
                <span className="mono">*CMDR*</span>, y enlaces de mazos públicos.
              </span>
            </div>
            <div className="field" style={{ maxWidth: 480 }}>
              <label className="label" htmlFor="import-name">
                Nombre <span className="subtle font-normal">(opcional)</span>
              </label>
              <input
                id="import-name"
                className="input"
                value={name}
                maxLength={120}
                placeholder="El de la lista o el del comandante"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {loggedIn ? (
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            ) : (
              <Banner tone="info">
                Sin cuenta, el mazo se abre en el analizador y se queda en este navegador.{" "}
                <Link href="/signup?next=/decks/new">Crea una cuenta</Link> para guardarlo.
              </Banner>
            )}
            {error && <Banner tone="out">{error}</Banner>}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
              {loggedIn && (
                <Link className="btn btn-ghost mr-auto" href="/analyze?new=1">
                  Solo analizarla, sin guardar
                </Link>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg full-sm"
                disabled={busy || !list.trim()}
              >
                {busy ? "Importando…" : loggedIn ? "Importar y guardar" : "Importar"}
              </button>
            </div>
            {busy && <Loading>Leyendo la lista y buscando las cartas…</Loading>}
          </form>
        </section>
      )}

      {source === "commander" && (
        <>
          <section className="panel">
            <div className="panel-h">
              <span className="h2">1 · El comandante</span>
            </div>
            <div className="flex flex-col gap-3 p-3.5">
              {commanders.length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {commanders.map((c) => (
                    <div key={c.oracleId} className="relative" style={{ width: 150 }}>
                      <CardImage card={c} />
                      <button
                        type="button"
                        className="btn btn-icon absolute"
                        style={{ top: 6, right: 6, width: 26, height: 26 }}
                        aria-label={`Quitar ${c.name}`}
                        onClick={() => {
                          setCommanders((prev) => prev.filter((x) => x.oracleId !== c.oracleId));
                          setInfo(null);
                        }}
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(commanders.length === 0 || pairing) && (
                <div style={{ maxWidth: 420 }}>
                  <CardSearch
                    id="commander"
                    label={
                      pairing ? "Segundo comandante (partner, background…)" : "Busca tu comandante"
                    }
                    filters={{ commander: true }}
                    autoFocus
                    clearOnPick
                    onPick={pick}
                  />
                </div>
              )}
              {commanders.length === 0 && mine && mine.length > 0 && (
                <div className="field">
                  <span className="label">De tu colección</span>
                  <div className="chips">
                    {mine.map((c) => (
                      <button
                        key={c.oracleId}
                        type="button"
                        className="chipbtn"
                        onClick={() => pick(c)}
                      >
                        <ColorPips colors={c.colorIdentity} />
                        {shortName(c.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {commanders.length === 1 && !pairing && (
                <button
                  type="button"
                  className="btn btn-ghost self-start"
                  onClick={() => setPairing(true)}
                >
                  Añadir un segundo comandante (partner, background…)
                </button>
              )}
            </div>
          </section>

          {commanders.length > 0 && (
            <section className="panel fade">
              <div className="panel-h">
                <span className="h2">2 · Cómo lo montas</span>
                {info?.totalDecks !== null && info?.totalDecks !== undefined && (
                  <span className="subtle text-xs">{fmt(info.totalDecks)} mazos analizados</span>
                )}
              </div>
              <div className="flex flex-col gap-4 p-3.5">
                <div
                  className="grid-1-sm grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${hasCollection ? 3 : 2}, minmax(0, 1fr))`,
                  }}
                >
                  {(
                    [
                      [
                        "average",
                        "Con el mazo medio de la comunidad",
                        "Las ~99 cartas que juega de media la gente con este comandante. Después te digo qué tienes, qué te falta y qué cambiar.",
                      ],
                      ...(hasCollection
                        ? ([
                            [
                              "owned",
                              "Con mis cartas",
                              "Lo que se recomienda para este comandante y tienes libre en tu colección, más básicas hasta 36 tierras. Si no llega a 99, completas el resto.",
                            ],
                          ] as const)
                        : []),
                      [
                        "empty",
                        "Desde cero",
                        "Solo el comandante. Añades tú las cartas una a una, con sugerencias de tu colección.",
                      ],
                    ] as const
                  ).map(([m, title, text]) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className="flex cursor-pointer flex-col gap-1 rounded-lg p-3 text-left"
                      style={{
                        border: `1px solid ${mode === m ? "var(--color-accent)" : "var(--color-line)"}`,
                        background: mode === m ? "var(--color-hover)" : "transparent",
                        color: "inherit",
                      }}
                    >
                      <span className="h2">{title}</span>
                      <span className="muted text-[13px]">{text}</span>
                    </button>
                  ))}
                </div>

                {mode !== "empty" && (
                  <div className="field">
                    <span className="label">Tema</span>
                    {loadingInfo ? (
                      <Loading>Buscando los temas…</Loading>
                    ) : (
                      <div className="chips" role="radiogroup" aria-label="Tema">
                        {[
                          { slug: "", name: "General", count: info?.totalDecks ?? null },
                          ...(info?.themes ?? []).slice(0, 14),
                        ].map((t) => (
                          <button
                            key={t.slug || "general"}
                            type="button"
                            role="radio"
                            aria-checked={theme === t.slug}
                            className={`chipbtn ${theme === t.slug ? "is-on" : ""}`}
                            onClick={() => setTheme(t.slug)}
                          >
                            {t.name}
                            {t.count !== null && <span className="n">{compact(t.count)}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="field" style={{ maxWidth: 480 }}>
                  <label className="label" htmlFor="deck-name">
                    Nombre
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPips colors={[...new Set(commanders.flatMap((c) => c.colorIdentity))]} />
                    <input
                      id="deck-name"
                      className="input"
                      value={finalName}
                      maxLength={120}
                      onChange={(e) => {
                        setNameTouched(true);
                        setName(e.target.value);
                      }}
                    />
                  </div>
                  <span className="hint">Colores - de qué va el mazo. Puedes cambiarlo.</span>
                </div>

                {loggedIn ? (
                  <VisibilityPicker value={visibility} onChange={setVisibility} />
                ) : (
                  <Banner tone="info">
                    Sin cuenta, el mazo se abre en el analizador y se queda en este navegador.{" "}
                    <Link href="/signup?next=/decks/new">Crea una cuenta</Link> para guardarlo.
                  </Banner>
                )}

                {error && <Banner tone="out">{error}</Banner>}
                <div className="flex justify-end border-t border-line pt-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg full-sm"
                    disabled={busy || (mode !== "empty" && loadingInfo)}
                    onClick={() => void create()}
                  >
                    {busy
                      ? "Creando…"
                      : mode === "average"
                        ? "Crear con el mazo medio"
                        : mode === "owned"
                          ? "Crear con mis cartas"
                          : "Crear vacío"}
                  </button>
                </div>
                {busy && mode !== "empty" && (
                  <Loading>
                    {mode === "owned"
                      ? "Buscando en tu colección lo que se recomienda…"
                      : "Montando el mazo medio de la comunidad…"}
                  </Loading>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
