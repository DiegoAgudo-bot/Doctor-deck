"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applySwaps, changeCard, exportDecklist, type ExportableDeck } from "@/domain/deck/export";
import type { Bracket } from "@/domain/deck/bracket";
import type { DeckVisibility } from "@/domain/deck/visibility";
import { formatEuros } from "@/domain/suggestions/format";
import type { AnalyzeResponse, CardDTO, DeckViewDTO } from "@/server/dto";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { CardHover, CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { BuyPanel, type BuyOptions } from "./deck-buy";
import { BracketPanel, BracketPill } from "./deck-bracket";
import { OpeningHand } from "./deck-hand";
import { OwnershipPanel } from "./deck-ownership";
import { ExportDialog, SaveDialog } from "./deck-dialogs";
import {
  DeckFacts,
  DeckList,
  DiffSkeleton,
  ManaCurve,
  RoleMeters,
  SwapDiff,
  averageCmc,
  type Decision,
  type ListView,
} from "./deck-views";
import { IconCart, IconWarn } from "./icons";
import {
  LOCAL_COLLECTION_EVENT,
  localCollection,
  notifyDecksChanged,
  ownedPairs,
} from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Loading } from "./ui";

interface Saved {
  input: string;
  theme: string;
  locked: string[];
  excluded: string[];
  /** Mazo guardado abierto (uuid; null = sin guardar). */
  deckId: string | null;
  name: string;
  /** Descontar copias usadas en mis otros mazos guardados. */
  useOtherDecks: boolean;
  /** Quién lo ve al guardarlo (público, oculto o privado). */
  visibility: DeckVisibility;
  /** Bracket al que apunta: limita los cambios propuestos. */
  targetBracket: Bracket | null;
}

const KEY = "deck-doctor:mazo";
const SOURCE_LABEL: Record<string, string> = { archidekt: "Archidekt", moxfield: "Moxfield" };
const EMPTY: Saved = {
  input: "",
  theme: "",
  locked: [],
  excluded: [],
  deckId: null,
  name: "",
  useOtherDecks: true,
  visibility: "public",
  targetBracket: null,
};
const PLACEHOLDER =
  "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1x Arcane Signet (C21) 263\n…";

type Ok = Extract<AnalyzeResponse, { status: "ok" }>;
type Tab = "cambios" | "falta" | "lista" | "stats" | "compra";
type Filter = "todos" | "pendientes" | "aceptados" | "descartados";

const isLink = (s: string) => /^\s*https?:\/\//i.test(s);
const shortName = (name: string) => name.split(/,| \/\/ /)[0] ?? name;

/** Con `deckId` abre ese mazo guardado (/decks/{uuid}); sin él, el analizador (/mazo). */
export function DeckDoctor({ deckId }: { deckId?: string } = {}) {
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [buy, setBuy] = useState<BuyOptions | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  /**
   * Abriendo un mazo guardado (/decks/{id}): hasta que llega el análisis se enseña una carga, no
   * el formulario con la lista (si no, la lista aparece un instante y luego salta al mazo).
   */
  const [opening, setOpening] = useState(Boolean(deckId));
  const [mode, setMode] = useState<"texto" | "enlace">("texto");
  const [tab, setTab] = useState<Tab>("cambios");
  const [filter, setFilter] = useState<Filter>("todos");
  const [view, setView] = useState<ListView>("pilas");
  const [dialog, setDialog] = useState<"save" | "export" | null>(null);
  /** Panel "Añadir cartas" de la lista abierto (al crear un mazo desde cero, de entrada). */
  const [adding, setAdding] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  /** Si el mazo abierto es de otro (público): de quién. Se analiza con MI colección. */
  const [owner, setOwner] = useState<DeckViewDTO["owner"] | null>(null);
  // Colección en este navegador (sin cuenta). Se lee tras montar: el servidor no tiene localStorage.
  const [hasLocal, setHasLocal] = useState(false);
  useEffect(() => {
    const read = () => setHasLocal(localCollection.get() !== null);
    read();
    window.addEventListener(LOCAL_COLLECTION_EVENT, read);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, read);
  }, []);
  const hasCollection = loggedIn || hasLocal;

  // Abrir el mazo guardado, empezar uno nuevo (?nuevo=1) o restaurar el último analizado.
  // ?tab=… abre esa pestaña; ?editar=1, la lista con el editor; ?analizar=1 analiza lo restaurado
  // (lo usa el asistente de "Nuevo mazo" sin cuenta).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const startTab = params.get("tab");
    if (startTab && ["cambios", "falta", "lista", "stats", "compra"].includes(startTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras montar
      setTab(startTab as Tab);
    }
    if (params.has("editar")) {
      setView("lista");
      setAdding(true);
    }
    if (deckId) {
      api<DeckViewDTO>(`/api/decks/${encodeURIComponent(deckId)}`)
        .then((d) => {
          // El de otro se abre como un mazo sin guardar: guardarlo crea una copia mía.
          const next: Saved = {
            ...EMPTY,
            input: d.input,
            theme: d.theme ?? "",
            locked: d.isMine ? d.locked : [],
            excluded: d.isMine ? d.excluded : [],
            deckId: d.isMine ? d.id : null,
            name: d.name,
            visibility: d.isMine ? d.visibility : "public",
            targetBracket: d.isMine ? d.targetBracket : null,
          };
          if (!d.isMine) {
            setOwner(d.owner);
            // El mazo de otro: lo primero es ver qué me falta para montarlo.
            setTab("falta");
          }
          setSaved(next);
          setMode(isLink(d.input) ? "enlace" : "texto");
          setHydrated(true);
          setChosen(d.commanders);
          void analyze(next, d.commanders).finally(() => setOpening(false));
        })
        .catch((e: unknown) => {
          setError(e instanceof ApiError ? e.message : "No se pudo abrir el mazo");
          setHydrated(true);
          setOpening(false);
        });
      return;
    }
    if (params.has("nuevo")) {
      window.history.replaceState(null, "", "/mazo");
      setSaved(EMPTY);
    } else {
      const stored = storage.get<Partial<Saved>>(KEY, {});
      // Versiones anteriores guardaban el id numérico del mazo: ya no vale.
      const restored = {
        ...EMPTY,
        ...stored,
        deckId: typeof stored.deckId === "string" ? stored.deckId : null,
      };
      setSaved(restored);
      setMode(isLink(restored.input) ? "enlace" : "texto");
      if (params.has("analizar") && restored.input.trim()) {
        window.history.replaceState(null, "", "/mazo");
        setOpening(true);
        void analyze(restored, []).finally(() => setOpening(false));
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);
  useEffect(() => {
    // El mazo de otro no pisa mi último mazo guardado en el navegador.
    if (hydrated && !owner) storage.set(KEY, saved);
  }, [saved, hydrated, owner]);

  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));
  const locked = useMemo(() => new Set(saved.locked), [saved.locked]);

  async function analyze(
    next: Partial<Saved> = {},
    commanders: string[] = chosen,
    buyOptions: BuyOptions | null = buy,
  ) {
    const req = { ...saved, ...next };
    if (!req.input.trim()) return;
    setBusy(buyOptions && buyOptions !== buy ? "buy" : "analyze");
    setError(null);
    setNotice(null);
    // Sin cuenta, la colección vive en el navegador y se manda con cada análisis.
    const local = loggedIn ? null : localCollection.get();
    try {
      const res = await api<AnalyzeResponse>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: req.input,
          ...(req.theme ? { theme: req.theme } : {}),
          ...(commanders.length > 0 ? { commanders } : {}),
          locked: req.locked,
          excluded: req.excluded,
          useOtherDecks: req.useOtherDecks,
          ...(req.deckId !== null ? { deckId: req.deckId } : {}),
          ...(buyOptions ? { buy: buyOptions } : {}),
          ...(req.targetBracket ? { targetBracket: req.targetBracket } : {}),
          ...(local ? { collection: ownedPairs(local) } : {}),
        }),
      });
      setResult(res);
      setDecisions({});
      setDirty(false);
      setEditing(false);
      update(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo analizar el mazo");
    } finally {
      setBusy(null);
    }
  }

  const ok = result?.status === "ok" ? result : null;
  const accepted = ok ? ok.swaps.filter((s) => decisions[s.id] === "accepted") : [];
  const rejected = ok ? ok.swaps.filter((s) => decisions[s.id] === "rejected") : [];
  const pending = ok ? ok.swaps.length - accepted.length - rejected.length : 0;

  const baseDeck: ExportableDeck | null = ok
    ? {
        commanders: ok.commanders,
        cards: ok.cards.map((c) => ({
          oracleId: c.card.oracleId,
          name: c.card.name,
          layout: c.card.layout,
          quantity: c.quantity,
        })),
      }
    : null;
  const finalDeck = baseDeck
    ? applySwaps(
        baseDeck,
        accepted.map((s) => ({ outOracleId: s.out.card.oracleId, in: s.in.card })),
      )
    : null;
  const exportText = finalDeck ? exportDecklist(finalDeck) : "";
  const changesText = accepted
    .map((s) => `- 1 ${s.out.card.name}\n+ 1 ${s.in.card.name}`)
    .join("\n");
  const leaving = new Set(accepted.map((s) => s.out.card.oracleId));

  /** Aplica los aceptados a la lista, excluye los descartados y vuelve a analizar. */
  function applyAndRecalculate() {
    if (!finalDeck) return;
    void analyze({
      input: exportDecklist(finalDeck),
      excluded: [...new Set([...saved.excluded, ...rejected.map((s) => s.in.card.oracleId)])],
    });
  }

  async function saveDeck({
    name,
    asNew,
    includeAccepted,
    visibility,
  }: {
    name: string;
    asNew: boolean;
    includeAccepted: boolean;
    visibility: DeckVisibility;
  }) {
    if (!ok) return;
    setBusy("save");
    setError(null);
    try {
      const input = includeAccepted && accepted.length > 0 ? exportText : saved.input;
      const res = await api<{ id: string; name: string }>("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(saved.deckId !== null && !asNew ? { id: saved.deckId } : {}),
          ...(name ? { name } : {}),
          input,
          ...(saved.theme ? { theme: saved.theme } : {}),
          commanders: ok.commanders.map((c) => c.oracleId),
          locked: saved.locked,
          excluded: saved.excluded,
          visibility,
          targetBracket: saved.targetBracket,
        }),
      });
      update({ deckId: res.id, name: res.name, input, visibility });
      setOwner(null);
      window.history.replaceState(null, "", `/decks/${res.id}`);
      setNotice(`Guardado como «${res.name}».`);
      setDialog(null);
      notifyDecksChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el mazo");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Añade (delta > 0) o quita (delta < 0) copias de una carta: rehace la lista, vuelve a analizar y,
   * si es uno de mis mazos guardados, lo guarda.
   */
  /** Cambia el bracket objetivo: reanaliza y, si es un mazo mío guardado, lo guarda. */
  async function changeTarget(targetBracket: Bracket | null) {
    await analyze({ targetBracket });
    if (saved.deckId === null || owner) return;
    try {
      await api(`/api/decks/${saved.deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetBracket }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el bracket objetivo");
    }
  }

  async function editCard(card: { oracleId: string; name: string }, delta: number) {
    if (!baseDeck) return;
    const input = exportDecklist(changeCard(baseDeck, card, delta));
    setEditNotice(null);
    await analyze({ input });
    if (saved.deckId !== null && ok) {
      try {
        await api("/api/decks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: saved.deckId,
            name: saved.name,
            input,
            ...(saved.theme ? { theme: saved.theme } : {}),
            commanders: ok.commanders.map((c) => c.oracleId),
            locked: saved.locked,
            excluded: saved.excluded,
          }),
        });
        notifyDecksChanged();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
        return;
      }
    }
    setEditNotice(
      delta > 0
        ? `Añadida: ${card.name}${saved.deckId ? " (guardado)" : ""}.`
        : `Quitada una copia de ${card.name}${saved.deckId ? " (guardado)" : ""}.`,
    );
  }

  function toggleLock(oracleId: string) {
    const next = new Set(saved.locked);
    if (next.has(oracleId)) next.delete(oracleId);
    else next.add(oracleId);
    update({ locked: [...next] });
    setDirty(true);
  }

  const decide = (id: string, d: Decision | undefined) =>
    setDecisions((prev) => {
      const next = { ...prev };
      if (d) next[id] = d;
      else delete next[id];
      return next;
    });

  // La lista solo se enseña para analizar uno nuevo, al pulsar "Cambiar lista" o si no se pudo abrir.
  const showForm = (!ok && !opening) || editing;
  const analyzing = busy === "analyze";

  return (
    <main className="page max-w-[1240px]">
      {opening && !ok && <OpeningDeck />}
      {showForm && (
        <EntryForm
          title={ok ? "Cambiar la lista" : "Analizar mazo"}
          input={saved.input}
          onInput={(input) => update({ input })}
          mode={mode}
          onMode={setMode}
          useOtherDecks={saved.useOtherDecks}
          onUseOtherDecks={(v) => {
            update({ useOtherDecks: v });
            setDirty(true);
          }}
          loggedIn={loggedIn}
          hasCollection={hasCollection}
          analyzing={analyzing}
          onCancel={ok ? () => setEditing(false) : null}
          onSubmit={() => {
            setChosen([]);
            setTab("cambios");
            void analyze({}, []);
          }}
          openDeck={saved.deckId !== null ? saved.name : null}
          onCloseDeck={() => {
            setSaved({ ...EMPTY, input: saved.input });
            setResult(null);
            window.history.replaceState(null, "", "/mazo");
          }}
        />
      )}

      {error && <Banner tone="out">{error}</Banner>}
      {notice && <Banner tone="in">{notice}</Banner>}

      {result?.status === "needs_commander" && !editing && (
        <CommanderPicker
          candidates={result.candidates}
          chosen={chosen}
          onToggle={(id) =>
            setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)))
          }
          onConfirm={() => void analyze({}, chosen)}
          busy={analyzing}
        />
      )}

      {ok && (
        <>
          {analyzing && !showForm && (
            <div className="progress" role="status" aria-label="Recalculando">
              <i />
            </div>
          )}
          <DeckHeader
            ok={ok}
            name={saved.name || ok.deckName || ok.commanders.map((c) => c.name).join(" + ")}
            owner={owner}
            onShowMissing={() => setTab("falta")}
            onSave={() => setDialog("save")}
            onExport={() => setDialog("export")}
            onBuy={() => setTab("compra")}
            onEdit={() => setEditing(true)}
            target={saved.targetBracket}
            onShowBracket={() => setTab("stats")}
          />

          {ok.edhrec.themes.length > 0 && (
            <div className="field">
              <span className="label">Tema de EDHREC</span>
              <div className="chips scroll-sm" role="radiogroup" aria-label="Tema">
                {[
                  { slug: "", name: "General", count: ok.edhrec.totalDecks },
                  ...ok.edhrec.themes.slice(0, 12),
                ].map((t) => (
                  <button
                    key={t.slug || "general"}
                    type="button"
                    role="radio"
                    aria-checked={saved.theme === t.slug}
                    className={`chipbtn ${saved.theme === t.slug ? "is-on" : ""}`}
                    disabled={busy !== null}
                    onClick={() => saved.theme !== t.slug && void analyze({ theme: t.slug })}
                  >
                    {t.name}
                    {t.count !== null && <span className="n">{compact(t.count)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Issues ok={ok} />

          <nav className="tabs" aria-label="Secciones del mazo">
            {(
              [
                ["cambios", "Cambios", pending],
                ["falta", "Qué me falta", ok.ownership.totals.toBuy],
                ["lista", "Lista", ok.totalCards],
                ["stats", "Estadísticas", null],
                ["compra", "Mejorar comprando", null],
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
                {n !== null && <span className="n">{n}</span>}
              </button>
            ))}
          </nav>

          {tab === "cambios" && (
            <div
              className="grid-1-sm grid items-start gap-5"
              style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}
            >
              <section className="flex min-w-0 flex-col gap-3">
                {ok.swaps.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="chips">
                      {(
                        [
                          ["todos", "Todos", ok.swaps.length],
                          ["pendientes", "Pendientes", pending],
                          ["aceptados", "Aceptados", accepted.length],
                          ["descartados", "Descartados", rejected.length],
                        ] as const
                      ).map(([id, label, n]) => (
                        <button
                          key={id}
                          type="button"
                          className={`chipbtn ${filter === id ? "is-on" : ""}`}
                          aria-pressed={filter === id}
                          onClick={() => setFilter(id)}
                        >
                          {label} <span className="n">{n}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {pending > 0 && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            setDecisions((prev) => {
                              const next = { ...prev };
                              for (const s of ok.swaps) next[s.id] ??= "accepted";
                              return next;
                            })
                          }
                        >
                          Aceptar todos
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          busy !== null ||
                          (accepted.length === 0 && rejected.length === 0 && !dirty)
                        }
                        onClick={applyAndRecalculate}
                      >
                        {analyzing
                          ? "Recalculando…"
                          : accepted.length > 0
                            ? `Aplicar ${accepted.length} y recalcular`
                            : "Recalcular"}
                      </button>
                    </div>
                  </div>
                )}
                {analyzing ? (
                  <DiffSkeleton />
                ) : ok.swaps.length === 0 ? (
                  <NoSwaps hasCollection={hasCollection} />
                ) : (
                  <div className="diff">
                    {ok.swaps
                      .filter((s) => {
                        const d = decisions[s.id];
                        return (
                          filter === "todos" ||
                          (filter === "pendientes" && !d) ||
                          (filter === "aceptados" && d === "accepted") ||
                          (filter === "descartados" && d === "rejected")
                        );
                      })
                      .map((s) => (
                        <SwapDiff
                          key={s.id}
                          swap={s}
                          decision={decisions[s.id]}
                          onDecide={(d) => decide(s.id, d)}
                          commanderName={shortName(ok.commanders[0]?.name ?? "")}
                        />
                      ))}
                  </div>
                )}
              </section>
              <aside className="flex flex-col gap-3">
                <ManaCurve
                  cards={[...ok.commanders.map((card) => ({ card, quantity: 1 })), ...ok.cards]}
                />
                <RoleMeters roles={ok.roles} />
                {loggedIn && (ok.unavailableCandidates.length > 0 || !saved.useOtherDecks) && (
                  <InOtherDecks
                    ok={ok}
                    useOtherDecks={saved.useOtherDecks}
                    busy={busy !== null}
                    onToggle={(v) => void analyze({ useOtherDecks: v })}
                  />
                )}
              </aside>
            </div>
          )}

          {tab === "lista" && (
            <section className="flex flex-col gap-3">
              <div className="stack-sm flex flex-wrap items-center justify-between gap-2.5">
                <h2 className="h2" style={{ fontSize: 17 }}>
                  Lista{" "}
                  <span className="mono subtle" style={{ fontSize: 13, fontWeight: 400 }}>
                    {ok.totalCards}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {(saved.locked.length > 0 || saved.excluded.length > 0) && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        update({ locked: [], excluded: [] });
                        setDirty(true);
                      }}
                    >
                      Olvidar candados y descartes ({saved.locked.length + saved.excluded.length})
                    </button>
                  )}
                  <div className="btn-group" role="group" aria-label="Ver como">
                    {(["pilas", "lista", "texto"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`btn ${view === v ? "is-on" : ""}`}
                        aria-pressed={view === v}
                        onClick={() => setView(v)}
                      >
                        {v === "pilas" ? "Pilas" : v === "lista" ? "Lista" : "Texto"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {view !== "texto" && (
                <p className="muted flex flex-wrap items-center gap-1.5 text-xs">
                  <span
                    className="lockmark"
                    style={{ position: "static", width: 16, height: 16 }}
                    aria-hidden="true"
                  />
                  Bloqueada: nunca se propone para salir.{" "}
                  {view === "pilas"
                    ? "Haz clic en una carta para bloquearla."
                    : "Usa el candado de cada fila."}
                  {dirty && (
                    <span className="pill pill-warn">
                      · Pulsa Recalcular en Cambios para aplicarlo.
                    </span>
                  )}
                </p>
              )}
              {!owner && (
                <DeckEditor
                  ok={ok}
                  open={adding}
                  onToggle={() => setAdding((a) => !a)}
                  busy={busy !== null}
                  notice={editNotice}
                  onAdd={(card) => void editCard(card, 1)}
                />
              )}
              {ok.cards.length === 0 ? (
                <div className="panel muted p-4 text-[13px]">
                  Solo está el comandante. Añade cartas con el buscador de arriba.
                </div>
              ) : (
                <DeckList
                  view={view}
                  cards={ok.cards}
                  locked={locked}
                  leaving={leaving}
                  onToggleLock={toggleLock}
                  text={exportText}
                  onChangeQuantity={owner ? undefined : (card, delta) => void editCard(card, delta)}
                  busy={busy !== null}
                />
              )}
            </section>
          )}

          {tab === "stats" && (
            <div
              className="grid-1-sm grid items-start gap-4"
              style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <BracketPanel
                  bracket={ok.bracket}
                  target={saved.targetBracket}
                  busy={busy !== null}
                  canSetTarget={!owner}
                  onTarget={(b) => void changeTarget(b)}
                />
              </div>
              <ManaCurve
                cards={[...ok.commanders.map((card) => ({ card, quantity: 1 })), ...ok.cards]}
              />
              <RoleMeters roles={ok.roles} />
              <DeckFacts cards={ok.cards} />
              <div style={{ gridColumn: "1 / -1" }}>
                <OpeningHand cards={ok.cards} />
              </div>
            </div>
          )}

          {tab === "falta" && (
            <OwnershipPanel
              ownership={ok.ownership}
              hasCollection={hasCollection}
              loggedIn={loggedIn}
            />
          )}

          {tab === "compra" && (
            <BuyPanel
              purchases={ok.purchases}
              options={buy}
              busy={busy === "buy" || analyzing}
              onSearch={(opts) => {
                setBuy(opts);
                void analyze({}, chosen, opts);
              }}
            />
          )}

          <SaveDialog
            open={dialog === "save"}
            onClose={() => setDialog(null)}
            loggedIn={loggedIn}
            deckId={saved.deckId}
            copyOf={owner}
            visibility={saved.visibility}
            defaultName={saved.name || ok.deckName || ""}
            acceptedCount={accepted.length}
            busy={busy === "save"}
            onSave={(o) => void saveDeck(o)}
          />
          <ExportDialog
            open={dialog === "export"}
            onClose={() => setDialog(null)}
            deck={finalDeck ?? { commanders: [], cards: [] }}
            changes={changesText}
          />
        </>
      )}
    </main>
  );
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString("es", { maximumFractionDigits: 1 })}K` : String(n);

function EntryForm({
  title,
  input,
  onInput,
  mode,
  onMode,
  useOtherDecks,
  onUseOtherDecks,
  loggedIn,
  hasCollection,
  analyzing,
  onCancel,
  onSubmit,
  openDeck,
  onCloseDeck,
}: {
  title: string;
  input: string;
  onInput: (v: string) => void;
  mode: "texto" | "enlace";
  onMode: (m: "texto" | "enlace") => void;
  useOtherDecks: boolean;
  onUseOtherDecks: (v: boolean) => void;
  loggedIn: boolean;
  hasCollection: boolean;
  analyzing: boolean;
  onCancel: (() => void) | null;
  onSubmit: () => void;
  openDeck: string | null;
  onCloseDeck: () => void;
}) {
  return (
    <>
      <h1 className="h1">{title}</h1>
      <div
        className="grid-1-sm grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}
      >
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <nav className="tabs" style={{ padding: "0 6px" }} aria-label="Cómo darme el mazo">
            {(["texto", "enlace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? "is-active" : ""}
                aria-pressed={mode === m}
                onClick={() => onMode(m)}
              >
                {m === "texto" ? "Pegar lista" : "Enlace"}
              </button>
            ))}
          </nav>
          <div className="flex flex-col gap-3.5 p-3.5">
            {mode === "texto" ? (
              <div className="field">
                <label className="label" htmlFor="lista">
                  Lista{" "}
                  <span className="subtle" style={{ fontWeight: 400 }}>
                    (una carta por línea)
                  </span>
                </label>
                <textarea
                  id="lista"
                  className="textarea"
                  spellCheck={false}
                  value={isLink(input) ? "" : input}
                  placeholder={PLACEHOLDER}
                  onChange={(e) => onInput(e.target.value)}
                />
              </div>
            ) : (
              <div className="field">
                <label className="label" htmlFor="url">
                  Enlace del mazo
                </label>
                <input
                  id="url"
                  className="input mono"
                  type="url"
                  value={isLink(input) ? input : ""}
                  placeholder="https://www.moxfield.com/decks/…"
                  onChange={(e) => onInput(e.target.value)}
                />
                <span className="hint">Archidekt y Moxfield, mazos públicos o sin listar.</span>
              </div>
            )}
            {loggedIn && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={!useOtherDecks}
                  onChange={(e) => onUseOtherDecks(!e.target.checked)}
                />
                <span>
                  No descontar cartas usadas en otros mazos{" "}
                  <span className="subtle">— tratarlas como libres</span>
                </span>
              </label>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
              {openDeck && (
                <button type="button" className="btn btn-ghost mr-auto" onClick={onCloseDeck}>
                  Cerrar «{openDeck}»
                </button>
              )}
              {onCancel && !analyzing && (
                <button type="button" className="btn btn-lg" onClick={onCancel}>
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg full-sm"
                disabled={analyzing || !input.trim()}
              >
                {analyzing ? "Analizando…" : "Analizar"}
              </button>
            </div>
          </div>
          {analyzing && (
            <div className="border-t border-line px-3.5 py-3">
              <Loading>
                Leyendo la lista y pidiendo recomendaciones a EDHREC…{" "}
                <span className="subtle">
                  Luego lo cruzo con tu colección. Suele tardar unos segundos.
                </span>
              </Loading>
            </div>
          )}
        </form>
        <aside className="panel">
          <div className="panel-h">
            <span className="h2">Cómo funciona</span>
          </div>
          <div className="flex flex-col gap-2.5 p-3 text-[13px]">
            <p className="muted">
              Detecto el comandante, pido a EDHREC lo que juega la gente con él y te propongo
              cambios 1×1: qué carta sacar y cuál meter.
            </p>
            <p className="muted">
              Formatos: <span className="mono">1 Sol Ring</span>,{" "}
              <span className="mono">1x Sol Ring (C21) 263</span>, secciones{" "}
              <span className="mono">Commander</span>/<span className="mono">Deck</span> o{" "}
              <span className="mono">*CMDR*</span>, y exports de Moxfield y Archidekt.
            </p>
            {!hasCollection && (
              <Banner tone="warn">
                Sin colección solo puedo proponerte compras.{" "}
                <Link href="/coleccion">Importa tu CSV de ManaBox</Link>.
              </Banner>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function CommanderPicker({
  candidates,
  chosen,
  onToggle,
  onConfirm,
  busy,
}: {
  candidates: CardDTO[];
  chosen: string[];
  onToggle: (oracleId: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const names = candidates.filter((c) => chosen.includes(c.oracleId)).map((c) => shortName(c.name));
  return (
    <section className="panel fade">
      <div className="panel-h stack-sm py-2">
        <span className="h2">Elige el comandante</span>
        <span className="muted text-[13px]">
          La lista no lo marca. Candidatas encontradas: {candidates.length}
        </span>
      </div>
      {candidates.length === 0 ? (
        <div className="p-4">
          <Banner tone="warn">
            No hay ninguna carta que pueda ser comandante en la lista. Márcalo con una sección
            «Commander» o con <span className="mono">*CMDR*</span>.
          </Banner>
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap gap-4 p-4"
            role="group"
            aria-label="Candidatos a comandante"
          >
            {candidates.map((c) => {
              const sel = chosen.includes(c.oracleId);
              return (
                <button
                  key={c.oracleId}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => onToggle(c.oracleId)}
                  className="flex cursor-pointer flex-col gap-2 rounded-lg p-2.5 text-left"
                  style={{
                    border: `1px solid ${sel ? "var(--color-accent)" : "var(--color-line)"}`,
                    background: sel ? "var(--color-hover)" : "transparent",
                    color: "inherit",
                    transition: "border-color var(--motion-150) var(--ease-out)",
                  }}
                >
                  <CardImage card={c} style={{ width: 180 }} />
                  <span className="flex items-center gap-2 text-[13px]">
                    <span
                      className="grid place-items-center rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        border: `1.5px solid ${sel ? "var(--color-accent)" : "var(--color-line-strong)"}`,
                      }}
                    >
                      <span
                        className="rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: "var(--color-accent)",
                          opacity: sel ? 1 : 0,
                        }}
                      />
                    </span>
                    {shortName(c.name)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="stack-sm flex items-center justify-between gap-3 px-4 pb-4">
            <span className="muted text-[13px]">
              Puedes elegir dos si son pareja (Partner, Background…).
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={chosen.length === 0 || busy}
              onClick={onConfirm}
            >
              {busy
                ? "Analizando…"
                : names.length > 0
                  ? `Analizar con ${names.join(" + ")}`
                  : "Elige uno"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function DeckHeader({
  ok,
  name,
  owner,
  onShowMissing,
  onSave,
  onExport,
  onBuy,
  onEdit,
  target,
  onShowBracket,
}: {
  ok: Ok;
  name: string;
  owner: DeckViewDTO["owner"] | null;
  onShowMissing: () => void;
  onSave: () => void;
  onExport: () => void;
  onBuy: () => void;
  onEdit: () => void;
  target: Bracket | null;
  onShowBracket: () => void;
}) {
  const identity = [...new Set(ok.commanders.flatMap((c) => c.colorIdentity))];
  const order = ["W", "U", "B", "R", "G"];
  const commander = ok.commanders[0];
  return (
    <section className="stack-sm flex flex-wrap items-start gap-5">
      {commander && (
        <div className="hide-sm flex flex-none flex-col gap-1.5" style={{ width: 132 }}>
          {ok.commanders.map((c) => (
            <CardHover key={c.oracleId} card={c} as="div">
              <CardImage card={c} />
            </CardHover>
          ))}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-2" style={{ flex: "1 1 300px" }}>
        <span className="cap">
          {owner ? (
            <>
              Mazo de{" "}
              {owner.username ? (
                <Link href={`/u/${owner.username}`}>@{owner.username}</Link>
              ) : (
                owner.name
              )}{" "}
              · comparado con tu colección
            </>
          ) : (
            <>
              Commander
              {ok.source !== "text"
                ? ` · importado de ${SOURCE_LABEL[ok.source] ?? ok.source}`
                : ""}
            </>
          )}
        </span>
        <h1 className="h1">{name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {name !== ok.commanders.map((c) => c.name).join(" + ") && (
            <span>{ok.commanders.map((c) => c.name).join(" + ")}</span>
          )}
          <ColorPips colors={order.filter((c) => identity.includes(c as never))} />
          <BracketPill bracket={ok.bracket} target={target} onClick={onShowBracket} />
        </div>
        <p className="subtle text-[13px]">
          {ok.totalCards} cartas · coste medio {averageCmc(ok.cards).toFixed(2).replace(".", ",")}
          {ok.edhrec.totalDecks !== null && (
            <> · {ok.edhrec.totalDecks.toLocaleString("es")} mazos en EDHREC</>
          )}
        </p>
        <OwnershipLine totals={ok.ownership.totals} onClick={onShowMissing} />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="btn-group">
          <button type="button" className="btn" onClick={onSave}>
            {owner ? "Copiar a mis mazos" : "Guardar"}
          </button>
          <button type="button" className="btn" onClick={onExport}>
            Exportar
          </button>
        </div>
        <button type="button" className="btn" onClick={onBuy}>
          <IconCart size={15} />
          Modo compra
        </button>
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          Cambiar lista
        </button>
      </div>
    </section>
  );
}

/**
 * Añadir cartas al mazo: buscador limitado a la identidad del comandante y, debajo, recomendadas
 * por EDHREC que tengo en la colección (lo que sugiere el análisis).
 */
function DeckEditor({
  ok,
  open,
  onToggle,
  busy,
  notice,
  onAdd,
}: {
  ok: Ok;
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  notice: string | null;
  onAdd: (card: CardDTO) => void;
}) {
  const identity = ["W", "U", "B", "R", "G"]
    .filter((c) => ok.commanders.some((k) => k.colorIdentity.includes(c as never)))
    .join("");
  const suggestions = ok.addCandidates.slice(0, 12);
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="h2">Añadir cartas</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 p-3.5">
          <div style={{ maxWidth: 440 }}>
            <CardSearch
              id="deck-add"
              label="Busca una carta (solo de los colores del comandante)"
              filters={{ identity }}
              clearOnPick
              onPick={(card) => !busy && onAdd(card)}
            />
          </div>
          {notice && <span className="pill pill-in">{notice}</span>}
          {busy && <span className="subtle text-xs">Actualizando el mazo…</span>}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label">
                De tu colección, recomendadas por EDHREC para este comandante
              </span>
              <div className="chips">
                {suggestions.map((s) => (
                  <CardHover key={s.card.oracleId} card={s.card}>
                    <button
                      type="button"
                      className="chipbtn"
                      disabled={busy}
                      onClick={() => onAdd(s.card)}
                      aria-label={`Añadir ${s.card.name}`}
                    >
                      + {s.card.name}
                      {s.inclusion !== null && (
                        <span className="n">{Math.round(s.inclusion * 100)} %</span>
                      )}
                    </button>
                  </CardHover>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** "Tienes 72 de 99 · te faltan 27 (≈ 85 €)", que lleva a la pestaña "Qué me falta". */
function OwnershipLine({
  totals,
  onClick,
}: {
  totals: Ok["ownership"]["totals"];
  onClick: () => void;
}) {
  const pct = totals.cards ? Math.round((totals.have / totals.cards) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex max-w-[420px] cursor-pointer flex-col gap-1.5 rounded-md border border-line bg-transparent p-2 text-left"
      style={{ color: "inherit", font: "inherit" }}
    >
      <span className="text-[13px]">
        Tienes <b className="mono">{totals.have}</b> de <b className="mono">{totals.cards}</b>
        {totals.toBuy > 0 ? (
          <>
            {" "}
            · te faltan{" "}
            <b className="mono" style={{ color: "var(--color-out)" }}>
              {totals.toBuy}
            </b>{" "}
            <span className="muted">(≈ {formatEuros(totals.cost)})</span>
          </>
        ) : (
          <span className="pill pill-in"> · lo tienes todo</span>
        )}
        {totals.fromOtherDecks > 0 && (
          <span className="muted"> · {totals.fromOtherDecks} en otros mazos</span>
        )}
      </span>
      <span className="role-bar" style={{ height: 4 }}>
        <i style={{ width: `${pct}%` }} />
      </span>
    </button>
  );
}

/** Mientras se abre un mazo guardado: la forma de la cabecera y del diff, sin la lista. */
function OpeningDeck() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <section className="flex items-start gap-5">
        <div className="skel hide-sm" style={{ width: 132, aspectRatio: "488/680" }} />
        <div className="flex flex-1 flex-col gap-3">
          <div className="skel" style={{ width: 140, height: 12 }} />
          <div className="skel" style={{ width: "50%", height: 26 }} />
          <div className="skel" style={{ width: "35%", height: 14 }} />
          <div className="skel" style={{ width: 260, height: 44 }} />
        </div>
      </section>
      <Loading>
        Abriendo el mazo y comparándolo con tu colección…{" "}
        <span className="subtle">
          Pido las recomendaciones a EDHREC; suele tardar unos segundos.
        </span>
      </Loading>
      <DiffSkeleton />
    </div>
  );
}

/** Avisos del análisis, plegados en una línea. */
function Issues({ ok }: { ok: Ok }) {
  const items: string[] = [
    ...ok.issues.map((i) => i.message),
    ...ok.unresolved.map((n) => `«${n}» no la encuentro en el catálogo.`),
    ...ok.skipped.map((s) => `Línea ${s.line} ignorada: ${s.text.trim()} (${s.reason}).`),
    ...(ok.edhrec.warning ? [ok.edhrec.warning] : []),
  ];
  if (items.length === 0) return null;
  return (
    <details className="issues">
      <summary>
        <IconWarn size={15} style={{ color: "var(--color-warn)" }} />
        <span>
          <b>{items.length === 1 ? "1 cosa que revisar" : `${items.length} cosas que revisar`}</b>{" "}
          <span className="muted">— {items[0]}</span>
        </span>
      </summary>
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </details>
  );
}

function NoSwaps({ hasCollection }: { hasCollection: boolean }) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-5 py-8 text-center">
      <span className="h2">No hay cambios que proponer</span>
      <span className="muted max-w-[420px] text-[13px]">
        {hasCollection
          ? "Ninguna carta de tu colección mejora el mazo con la configuración actual. Prueba otro tema de EDHREC o el modo compra."
          : "Sin tu colección no sé qué cartas tienes. Impórtala, o mira el modo compra."}
      </span>
      {!hasCollection && (
        <Link className="btn btn-primary" href="/coleccion">
          Importar colección
        </Link>
      )}
    </div>
  );
}

function InOtherDecks({
  ok,
  useOtherDecks,
  busy,
  onToggle,
}: {
  ok: Ok;
  useOtherDecks: boolean;
  busy: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">En otros mazos</span>
        <span className="mono subtle text-xs">{ok.unavailableCandidates.length}</span>
      </div>
      <div className="px-3 pt-1.5 pb-2.5">
        {ok.unavailableCandidates.slice(0, 8).map((c) => (
          <div key={c.card.oracleId} className="kv">
            <CardHover card={c.card} className="flex items-center gap-1.5">
              <span className="dot dot-inuse" />
              {c.card.name}
            </CardHover>
            <span className="subtle truncate">{c.usedIn?.join(", ")}</span>
          </div>
        ))}
        <label className="check subtle pt-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={!useOtherDecks}
            disabled={busy}
            onChange={(e) => onToggle(!e.target.checked)}
          />
          Proponerlas igualmente
        </label>
      </div>
    </div>
  );
}
