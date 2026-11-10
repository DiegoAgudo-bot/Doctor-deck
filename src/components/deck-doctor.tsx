"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applySwaps,
  changeCard,
  exportDecklist,
  setPrinting,
  type ExportableDeck,
} from "@/domain/deck/export";
import type { Bracket, BracketEstimate } from "@/domain/deck/bracket";
import { decklistWithCommanders } from "@/domain/deck/set-commander";
import type { DeckVisibility } from "@/domain/deck/visibility";
import type { ThemeLink } from "@/domain/recommendations/types";
import { formatEuros } from "@/domain/suggestions/format";
import { ROLE_TAGS } from "@/domain/roles/tags";
import type {
  AnalyzeResponse,
  CardDTO,
  CardRoleEditDTO,
  DeckCardDTO,
  DeckCombosDTO,
  PrintingDTO,
  DeckViewDTO,
} from "@/server/dto";
import { DeckComments } from "./deck-comments";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { CardHover, CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { BuyPanel, type BuyOptions } from "./deck-buy";
import { BracketPanel, BracketPill } from "./deck-bracket";
import { CombosPanel } from "./deck-combos";
import { OpeningHand } from "./deck-hand";
import { localRoles } from "./local-roles";
import { PrintingDialog } from "./printing-dialog";
import { RoleEditDialog, type RoleEditScope } from "./role-edit-dialog";
import { OtherDecksDialog, OwnershipPanel, collectionInput } from "./deck-ownership";
import { DeckSettingsDialog, ExportDialog, SaveDialog } from "./deck-dialogs";
import { CardNoteDialog, DeckCompareDialog, DeckDescription } from "./deck-notes";
import { setDeckVisibility } from "./deck-visibility";
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
import { IconHeart, IconSettings, IconWarn } from "./icons";
import {
  LOCAL_COLLECTION_EVENT,
  localCollection,
  notifyCollectionChanged,
  notifyDecksChanged,
  ownedPairs,
} from "./local-collection";
import { ColorPips } from "./mana";
import { SAMPLE_DECK } from "./sample-deck";
import { Banner, Loading } from "./ui";
import { Link, goTo, useIntlLocale, useLocale, useLocalePath, useT } from "@/components/i18n";

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
type Tab = "changes" | "missing" | "list" | "combos" | "stats" | "buy";
type Filter = "todos" | "pendientes" | "aceptados" | "descartados";

/**
 * Pestaña con la que se abre un análisis: sin colección no hay cambios que proponer (solo se
 * proponen cartas que tengo), así que se empieza por lo que falta.
 */
const firstTab = (hasCollection: boolean): Tab => (hasCollection ? "changes" : "missing");
const isLink = (s: string) => /^\s*https?:\/\//i.test(s);
const shortName = (name: string) => name.split(/,| \/\/ /)[0] ?? name;

/** Con `deckId` abre ese mazo guardado (/decks/{uuid}); sin él, el analizador (/analyze). */
export function DeckDoctor({ deckId }: { deckId?: string } = {}) {
  const t = useT();
  const lp = useLocalePath();
  const intl = useIntlLocale();
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session);
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<string | null>(null);
  /** Carta cuya impresión se está eligiendo. */
  const [printingCard, setPrintingCard] = useState<CardDTO | null>(null);
  /** Carta cuyos roles se están corrigiendo. */
  const [editingRoles, setEditingRoles] = useState<DeckCardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  /**
   * Temas de EDHREC del comandante. La página de un tema no trae la lista: se guarda la última que
   * llegó para poder cambiar de tema o volver a «General».
   */
  const [themes, setThemes] = useState<ThemeLink[]>([]);
  const [buy, setBuy] = useState<BuyOptions | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  /**
   * Abriendo un mazo guardado (/decks/{id}): hasta que llega el análisis se enseña una carga, no
   * el formulario con la lista (si no, la lista aparece un instante y luego salta al mazo).
   */
  const [opening, setOpening] = useState(Boolean(deckId));
  const [mode, setMode] = useState<"texto" | "enlace">("texto");
  const [tab, setTab] = useState<Tab>("changes");
  const [filter, setFilter] = useState<Filter>("todos");
  const [view, setView] = useState<ListView>("pilas");
  const [dialog, setDialog] = useState<"save" | "export" | "settings" | null>(null);
  /** Panel "Añadir cartas" de la lista abierto (al crear un mazo desde cero, de entrada). */
  const [adding, setAdding] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  /** Si el mazo abierto es de otro (público): de quién. Se analiza con MI colección. */
  const [owner, setOwner] = useState<DeckViewDTO["owner"] | null>(null);
  /** "Me gusta" del mazo guardado abierto (mío o de otro). */
  const [like, setLike] = useState<{ id: string; count: number; liked: boolean } | null>(null);
  /** Si lo que falta de este mazo (guardado y mío) está en mi lista de deseos. */
  const [inWishlist, setInWishlist] = useState(false);
  /** Del mazo guardado que se está viendo: descripción (pública) y mis notas por carta. */
  const [extra, setExtra] = useState<{
    id: string;
    description: string;
    cardNotes: Record<string, string>;
  } | null>(null);
  const [noteCard, setNoteCard] = useState<CardDTO | null>(null);
  const [comparing, setComparing] = useState(false);
  // Colección en este navegador (sin cuenta). Se lee tras montar: el servidor no tiene localStorage.
  const [hasLocal, setHasLocal] = useState(false);
  useEffect(() => {
    const read = () => setHasLocal(localCollection.get() !== null);
    read();
    window.addEventListener(LOCAL_COLLECTION_EVENT, read);
    return () => window.removeEventListener(LOCAL_COLLECTION_EVENT, read);
  }, []);
  const hasCollection = loggedIn || hasLocal;

  // Abrir el mazo guardado, empezar uno nuevo (?new=1) o restaurar el último analizado.
  // ?tab=… abre esa pestaña; ?edit=1, la lista con el editor; ?analyze=1 analiza lo restaurado
  // (lo usa el asistente de "Nuevo mazo" sin cuenta).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Los enlaces antiguos usaban parámetros en español (?nuevo=1, ?tab=falta…).
    for (const [old, now] of [
      ["nuevo", "new"],
      ["analizar", "analyze"],
      ["editar", "edit"],
    ]) {
      if (params.has(old!)) params.set(now!, "1");
    }
    const LEGACY_TABS: Record<string, string> = {
      cambios: "changes",
      falta: "missing",
      lista: "list",
      compra: "buy",
    };
    const tabParam = params.get("tab");
    const startTab = tabParam ? (LEGACY_TABS[tabParam] ?? tabParam) : null;
    if (startTab && ["changes", "missing", "list", "combos", "stats", "buy"].includes(startTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras montar
      setTab(startTab as Tab);
    }
    if (params.has("edit")) {
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
          setLike({ id: d.id, count: d.likes, liked: d.liked });
          setExtra({ id: d.id, description: d.description, cardNotes: d.cardNotes });
          setInWishlist(d.isMine && d.inWishlist);
          if (!d.isMine) {
            setOwner(d.owner);
            // El mazo de otro: lo primero es ver qué me falta para montarlo.
            setTab("missing");
          }
          setSaved(next);
          setMode(isLink(d.input) ? "enlace" : "texto");
          setHydrated(true);
          setChosen(d.commanders);
          void analyze(next, d.commanders).finally(() => setOpening(false));
        })
        .catch((e: unknown) => {
          setError(
            e instanceof ApiError
              ? e.message
              : t("No se pudo abrir el mazo", "Couldn't open the deck"),
          );
          setHydrated(true);
          setOpening(false);
        });
      return;
    }
    if (params.has("sample")) {
      // Desde la portada: el mazo de ejemplo, analizado al momento.
      window.history.replaceState(null, "", lp("/analyze"));
      const sample = { ...EMPTY, input: SAMPLE_DECK };
      setSaved(sample);
      setTab(firstTab(loggedIn || localCollection.get() !== null));
      setOpening(true);
      void analyze(sample, []).finally(() => setOpening(false));
    } else if (params.has("new")) {
      window.history.replaceState(null, "", lp("/analyze"));
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
      if (params.has("analyze") && restored.input.trim()) {
        window.history.replaceState(null, "", lp("/analyze"));
        setOpening(true);
        void analyze(restored, [])
          .then(() => {
            // ?save=1: vuelve de crear la cuenta desde «Guardar mazo»; se termina de guardar.
            if (params.has("save")) setDialog("save");
          })
          .finally(() => setOpening(false));
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

  /**
   * Guarda en la cuenta un mazo mío ya guardado con el estado `req` (lista, tema, candados y
   * descartes). La visibilidad y el bracket objetivo no se mandan: el servidor los conserva.
   * Devuelve false si falla (el error ya se enseña).
   */
  async function persistDeck(req: Saved, commanders: string[]): Promise<boolean> {
    if (req.deckId === null) return false;
    try {
      await api("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.deckId,
          name: req.name,
          input: req.input,
          ...(req.theme ? { theme: req.theme } : {}),
          commanders,
          locked: req.locked,
          excluded: req.excluded,
        }),
      });
      notifyDecksChanged();
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo guardar el mazo", "Couldn't save the deck"),
      );
      return false;
    }
  }

  /**
   * Analiza el mazo con `next` aplicado. Con `persist`, si es un mazo mío guardado, además lo
   * guarda (los cambios de un mazo guardado se guardan solos). Devuelve true si se guardó, false si
   * solo se analizó y null si falló.
   */
  async function analyze(
    next: Partial<Saved> = {},
    commanders: string[] = chosen,
    buyOptions: BuyOptions | null = buy,
    { persist = false }: { persist?: boolean } = {},
  ): Promise<boolean | null> {
    const req = { ...saved, ...next };
    if (!req.input.trim()) return null;
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
          ...(loggedIn ? {} : { roleEdits: localRoles.all() }),
        }),
      });
      setResult(res);
      if (res.status === "ok" && res.edhrec.themes.length > 0) setThemes(res.edhrec.themes);
      setDecisions({});
      setDirty(false);
      setEditing(false);
      update(next);
      if (!persist || req.deckId === null || res.status !== "ok") return false;
      return await persistDeck(
        req,
        res.commanders.map((c) => c.oracleId),
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo analizar el mazo", "Couldn't analyze the deck"),
      );
      return null;
    } finally {
      setBusy(null);
    }
  }

  const ok = result?.status === "ok" ? result : null;

  // Combos (Commander Spellbook): tras cada análisis, aparte porque tardan unos segundos. Al
  // llegar, el bracket estimado pasa a contar también los combos.
  const [combos, setCombos] = useState<{
    data: DeckCombosDTO | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: false });
  useEffect(() => {
    if (result?.status !== "ok") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se busca al cambiar el análisis
    setCombos((c) => ({ ...c, loading: true, error: null }));
    const local = loggedIn ? null : localCollection.get();
    api<DeckCombosDTO>(
      "/api/combos",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: saved.input,
          ...(chosen.length > 0 ? { commanders: chosen } : {}),
          ...(saved.deckId !== null ? { deckId: saved.deckId } : {}),
          useOtherDecks: saved.useOtherDecks,
          ...(local ? { collection: ownedPairs(local) } : {}),
          ...(loggedIn ? {} : { roleEdits: localRoles.all() }),
        }),
      },
      { silent: true },
    )
      .then((data) => !cancelled && setCombos({ data, error: null, loading: false }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setCombos({
            data: null,
            error:
              e instanceof ApiError
                ? e.message
                : t("No se pudieron buscar los combos", "Couldn't look up combos"),
            loading: false,
          }),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando hay un análisis nuevo
  }, [result]);
  const bracket =
    ok && combos.data && !combos.loading ? combos.data.bracket : (ok?.bracket ?? null);
  const accepted = ok ? ok.swaps.filter((s) => decisions[s.id] === "accepted") : [];
  const rejected = ok ? ok.swaps.filter((s) => decisions[s.id] === "rejected") : [];
  const pending = ok ? ok.swaps.length - accepted.length - rejected.length : 0;

  const baseDeck: ExportableDeck | null = ok
    ? {
        commanders: ok.commanders.map((c) => ({
          oracleId: c.oracleId,
          name: c.name,
          layout: c.layout,
          ...(c.printing ? { printing: c.printing } : {}),
          ...(c.foil ? { foil: true } : {}),
        })),
        cards: ok.cards.map((c) => ({
          oracleId: c.card.oracleId,
          name: c.card.name,
          layout: c.card.layout,
          quantity: c.quantity,
          ...(c.card.printing ? { printing: c.card.printing } : {}),
          ...(c.card.foil ? { foil: true } : {}),
          // Para exportar a Moxfield: el rol principal (si no es "sinergia") y mis etiquetas.
          tags: [
            ...(c.isBasicLand || c.primaryRole === "synergy" ? [] : [ROLE_TAGS[c.primaryRole]]),
            ...c.tags,
          ],
          // Las que venían en la lista (roles de la lista y etiquetas): se conservan al guardarla.
          listTags: [
            ...(c.roleSource === "list"
              ? c.roles.filter((r) => r !== "synergy" && r !== "land").map((r) => ROLE_TAGS[r])
              : []),
            ...c.tags,
          ],
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
  const inOtherDecks = new Map(
    (ok?.ownership.items ?? [])
      .filter((i) => i.fromOtherDecks > 0)
      .map((i) => [i.card.oracleId, i.usedIn] as const),
  );

  /** Aplica los aceptados a la lista, excluye los descartados y vuelve a analizar. */
  async function applyAndRecalculate() {
    if (!finalDeck) return;
    const n = accepted.length;
    const savedIt = await analyze(
      {
        input: exportDecklist(finalDeck),
        excluded: [...new Set([...saved.excluded, ...rejected.map((s) => s.in.card.oracleId)])],
      },
      chosen,
      buy,
      { persist: true },
    );
    if (savedIt) {
      setNotice(
        n > 0
          ? n === 1
            ? t("Aplicado 1 cambio y guardado.", "Applied 1 change and saved.")
            : t(`Aplicados ${n} cambios y guardado.`, `Applied ${n} changes and saved.`)
          : t("Guardado.", "Saved."),
      );
    }
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
      window.history.replaceState(null, "", lp(`/decks/${res.id}`));
      setNotice(t(`Guardado como «${res.name}».`, `Saved as “${res.name}”.`));
      setDialog(null);
      notifyDecksChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo guardar el mazo", "Couldn't save the deck"),
      );
    } finally {
      setBusy(null);
    }
  }

  /**
   * Añade (delta > 0) o quita (delta < 0) copias de una carta: rehace la lista, vuelve a analizar y,
   * si es uno de mis mazos guardados, lo guarda.
   */
  /** Ajustes de un mazo mío guardado (desde su página). */
  async function renameDeck(name: string) {
    if (saved.deckId === null) return;
    setBusy("settings");
    try {
      await api(`/api/decks/${encodeURIComponent(saved.deckId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      update({ name });
      notifyDecksChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo cambiar el nombre", "Couldn't rename it"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function changeVisibility(v: DeckVisibility) {
    if (saved.deckId === null) return;
    try {
      const { visibility } = await setDeckVisibility(api, saved.deckId, v);
      update({ visibility });
      notifyDecksChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo cambiar la visibilidad", "Couldn't change who can see it"),
      );
    }
  }

  async function deleteDeck() {
    if (saved.deckId === null) return;
    setBusy("settings");
    try {
      await api(`/api/decks/${encodeURIComponent(saved.deckId)}`, { method: "DELETE" });
      // Que no se reabra como «el último mazo» en /analyze.
      storage.remove(KEY);
      notifyDecksChanged();
      goTo("/decks");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo borrar el mazo", "Couldn't delete the deck"),
      );
      setBusy(null);
    }
  }

  async function toggleWishlist() {
    if (!saved.deckId) return;
    setBusy("wishlist");
    try {
      await api(`/api/decks/${saved.deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inWishlist: !inWishlist }),
      });
      setInWishlist(!inWishlist);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo cambiar la lista de deseos", "Couldn't update the wishlist"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleLike() {
    if (!like || !owner) return;
    const liked = !like.liked;
    setLike({ ...like, liked, count: like.count + (liked ? 1 : -1) });
    try {
      const res = await api<{ likes: number; liked: boolean }>(`/api/decks/${like.id}/like`, {
        method: liked ? "POST" : "DELETE",
      });
      setLike({ ...like, liked: res.liked, count: res.likes });
    } catch (err) {
      setLike(like);
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo guardar el «me gusta»", "Couldn't save the like"),
      );
    }
  }

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
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo guardar el bracket objetivo", "Couldn't save the target bracket"),
      );
    }
  }

  /** Guarda la corrección de roles de una carta (en la cuenta o en el navegador) y reanaliza. */
  async function saveRoles(card: DeckCardDTO, edit: CardRoleEditDTO, scope: RoleEditScope) {
    setBusy("roles");
    const id = encodeURIComponent(card.card.oracleId);
    try {
      if (loggedIn && scope === "deck" && saved.deckId !== null) {
        await api(`/api/decks/${encodeURIComponent(saved.deckId)}/card-roles/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(edit),
        });
      } else if (loggedIn) {
        await api(`/api/me/card-roles/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(edit),
        });
      } else {
        localRoles.set(card.card.oracleId, edit);
      }
      setEditingRoles(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudieron guardar los roles", "Couldn't save the roles"),
      );
      setBusy(null);
      return;
    }
    setBusy(null);
    await analyze();
  }

  /**
   * Reescribe la lista con un cambio (cartas o impresiones), la reanaliza y, si es un mazo mío
   * guardado, lo guarda. Devuelve si se guardó.
   */
  async function applyDeckEdit(next: ExportableDeck): Promise<boolean | null> {
    setEditNotice(null);
    return analyze({ input: exportDecklist(next) }, chosen, buy, { persist: true });
  }

  async function editCard(card: { oracleId: string; name: string }, delta: number) {
    if (!baseDeck) return;
    const savedIt = await applyDeckEdit(changeCard(baseDeck, card, delta));
    if (savedIt === null) return;
    setEditNotice(
      delta > 0
        ? t(
            `Añadida: ${card.name}${savedIt ? " (guardado)" : ""}.`,
            `Added: ${card.name}${savedIt ? " (saved)" : ""}.`,
          )
        : t(
            `Quitada una copia de ${card.name}${savedIt ? " (guardado)" : ""}.`,
            `Removed a copy of ${card.name}${savedIt ? " (saved)" : ""}.`,
          ),
    );
  }

  /** Elige la impresión de una carta (null = la de por defecto). */
  async function choosePrinting(card: CardDTO, printing: PrintingDTO | null) {
    if (!baseDeck) return;
    setPrintingCard(null);
    const savedIt = await applyDeckEdit(
      setPrinting(
        baseDeck,
        card.oracleId,
        printing ? { setCode: printing.setCode, collectorNumber: printing.collectorNumber } : null,
      ),
    );
    if (savedIt === null) return;
    setEditNotice(
      `${card.name}: ${printing ? `${printing.setName ?? printing.setCode.toUpperCase()} #${printing.collectorNumber}` : t("impresión por defecto", "default printing")}${savedIt ? t(" (guardado)", " (saved)") : ""}.`,
    );
  }

  /** Candados y descartes: en un mazo mío guardado se guardan al momento (sin reanalizar). */
  function changeMarks(patch: Pick<Partial<Saved>, "locked" | "excluded">) {
    update(patch);
    setDirty(true);
    if (ok && saved.deckId !== null) {
      void persistDeck(
        { ...saved, ...patch },
        ok.commanders.map((c) => c.oracleId),
      );
    }
  }

  function toggleLock(oracleId: string) {
    const next = new Set(saved.locked);
    if (next.has(oracleId)) next.delete(oracleId);
    else next.add(oracleId);
    changeMarks({ locked: [...next] });
  }

  /** Solo en un mazo mío guardado hay notas (y comparar). */
  const myNotes = extra && !owner && saved.deckId === extra.id ? extra : null;

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
    <main className="page">
      {opening && !ok && <OpeningDeck />}
      {showForm && (
        <EntryForm
          title={ok ? t("Cambiar la lista", "Change the list") : t("Analizar mazo", "Analyze deck")}
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
            setTab(firstTab(hasCollection));
            // «Cambiar lista» de un mazo mío guardado: la lista nueva se guarda en él.
            void analyze({}, [], buy, { persist: true });
          }}
          onSample={() => {
            setChosen([]);
            setMode("texto");
            setTab(firstTab(hasCollection));
            void analyze({ ...EMPTY, input: SAMPLE_DECK }, []);
          }}
          openDeck={saved.deckId !== null ? saved.name : null}
          onCloseDeck={() => {
            setSaved({ ...EMPTY, input: saved.input });
            setResult(null);
            window.history.replaceState(null, "", lp("/analyze"));
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
          onConfirm={() => void analyze({}, chosen, buy, { persist: true })}
          // Uno que no está en la lista (solo con texto: un enlace no se puede reescribir).
          onPickOutside={
            isLink(saved.input)
              ? undefined
              : (card) => {
                  setChosen([]);
                  void analyze(
                    { input: decklistWithCommanders(saved.input, [card.name]) },
                    [],
                    buy,
                    { persist: true },
                  );
                }
          }
          busy={analyzing}
        />
      )}

      {ok && (
        <>
          {analyzing && !showForm && (
            <div className="progress" role="status" aria-label={t("Recalculando", "Recalculating")}>
              <i />
            </div>
          )}
          <DeckHeader
            ok={ok}
            bracket={bracket ?? ok.bracket}
            name={saved.name || ok.deckName || ok.commanders.map((c) => c.name).join(" + ")}
            owner={owner}
            isSaved={saved.deckId !== null}
            onShowMissing={() => setTab("missing")}
            onSave={() => setDialog("save")}
            onSettings={() => setDialog("settings")}
            onCompare={() => setComparing(true)}
            onExport={() => setDialog("export")}
            onEdit={() => setEditing(true)}
            target={saved.targetBracket}
            onShowBracket={() => setTab("stats")}
            like={like && (owner || saved.deckId === like.id) ? like : null}
            canLike={Boolean(owner) && loggedIn}
            onLike={() => void toggleLike()}
          />
          {extra && (owner || saved.deckId === extra.id) && (
            <DeckDescription
              deckId={extra.id}
              text={extra.description}
              editable={!owner}
              onSaved={(description) => setExtra({ ...extra, description })}
            />
          )}

          {(themes.length > 0 || saved.theme !== "") && (
            <div className="field">
              <span className="label">{t("Tema", "Theme")}</span>
              <div className="chips scroll-sm" role="radiogroup" aria-label={t("Tema", "Theme")}>
                {[
                  { slug: "", name: t("General", "General"), count: ok.edhrec.totalDecks },
                  ...themeChips(themes, saved.theme),
                ].map((th) => (
                  <button
                    key={th.slug || "general"}
                    type="button"
                    role="radio"
                    aria-checked={saved.theme === th.slug}
                    className={`chipbtn ${saved.theme === th.slug ? "is-on" : ""}`}
                    disabled={busy !== null}
                    onClick={() =>
                      saved.theme !== th.slug &&
                      void analyze({ theme: th.slug }, chosen, buy, { persist: true })
                    }
                  >
                    {th.name}
                    {th.count !== null && <span className="n">{compact(th.count, intl)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Issues ok={ok} />

          <nav className="tabs" aria-label={t("Secciones del mazo", "Deck sections")}>
            {(
              [
                ["changes", t("Cambios", "Changes"), pending],
                ["missing", t("Qué me falta", "What I'm missing"), ok.ownership.totals.toBuy],
                ["list", t("Lista", "List"), ok.totalCards],
                [
                  "combos",
                  "Combos",
                  combos.data && !combos.loading ? combos.data.included.length : null,
                ],
                ["stats", t("Estadísticas", "Stats"), null],
                ["buy", t("Mejorar comprando", "Improve by buying"), null],
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

          {tab === "changes" && (
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
                          ["todos", t("Todos", "All"), ok.swaps.length],
                          ["pendientes", t("Pendientes", "Pending"), pending],
                          ["aceptados", t("Aceptados", "Accepted"), accepted.length],
                          ["descartados", t("Descartados", "Dismissed"), rejected.length],
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
                          {t("Aceptar todos", "Accept all")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          busy !== null ||
                          (accepted.length === 0 && rejected.length === 0 && !dirty)
                        }
                        onClick={() => void applyAndRecalculate()}
                      >
                        {analyzing
                          ? t("Recalculando…", "Recalculating…")
                          : accepted.length > 0
                            ? t(
                                `Aplicar ${accepted.length} y recalcular`,
                                `Apply ${accepted.length} and recalculate`,
                              )
                            : t("Recalcular", "Recalculate")}
                      </button>
                    </div>
                  </div>
                )}
                {ok.swaps.length > 0 && !analyzing && (
                  <p className="subtle text-[12.5px]">
                    {t(
                      "La cifra de cada cambio es la mejora estimada: cuánto más se juega con tu comandante la carta que entra que la que sale (sinergia e inclusión en la comunidad), con un extra si cubre el mismo rol o uno que te falta.",
                      "Each change's number is the estimated improvement: how much more the incoming card is played with your commander than the outgoing one (community synergy and inclusion), plus a bonus if it covers the same role or one you're short on.",
                    )}
                  </p>
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

          {tab === "list" && (
            <section className="flex flex-col gap-3">
              <div className="stack-sm flex flex-wrap items-center justify-between gap-2.5">
                <h2 className="h2" style={{ fontSize: 17 }}>
                  {t("Lista", "List")}{" "}
                  <span className="mono subtle" style={{ fontSize: 13, fontWeight: 400 }}>
                    {ok.totalCards}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {(saved.locked.length > 0 || saved.excluded.length > 0) && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => changeMarks({ locked: [], excluded: [] })}
                    >
                      {t("Olvidar candados y descartes", "Forget locks and dismissals")} (
                      {saved.locked.length + saved.excluded.length})
                    </button>
                  )}
                  <div className="btn-group" role="group" aria-label={t("Ver como", "View as")}>
                    {(["pilas", "lista", "texto"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`btn ${view === v ? "is-on" : ""}`}
                        aria-pressed={view === v}
                        onClick={() => setView(v)}
                      >
                        {v === "pilas"
                          ? t("Pilas", "Piles")
                          : v === "lista"
                            ? t("Lista", "List")
                            : t("Texto", "Text")}
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
                  {t("Bloqueada: nunca se propone para salir.", "Locked: never suggested to cut.")}{" "}
                  {view === "pilas"
                    ? t("Haz clic en una carta para bloquearla.", "Click a card to lock it.")
                    : t("Usa el candado de cada fila.", "Use the lock on each row.")}
                  {dirty && (
                    <span className="pill pill-warn">
                      ·{" "}
                      {t(
                        "Pulsa Recalcular en Cambios para aplicarlo.",
                        "Press Recalculate in Changes to apply it.",
                      )}
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
                  {t(
                    "Solo está el comandante. Añade cartas con el buscador de arriba.",
                    "Only the commander so far. Add cards with the search above.",
                  )}
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
                  onEditRoles={setEditingRoles}
                  onEditPrinting={owner ? undefined : setPrintingCard}
                  notes={myNotes?.cardNotes}
                  onEditNote={myNotes ? setNoteCard : undefined}
                  inOtherDecks={inOtherDecks}
                  busy={busy !== null}
                />
              )}
            </section>
          )}

          {tab === "combos" && (
            <CombosPanel data={combos.data} error={combos.error} loading={combos.loading} />
          )}

          {tab === "stats" && (
            <div
              className="grid-1-sm grid items-start gap-4"
              style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <BracketPanel
                  bracket={bracket ?? ok.bracket}
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

          {/* Móvil: el botón de aplicar queda arriba de la lista; con cambios aceptados, siempre a mano. */}
          {tab === "changes" && accepted.length > 0 && (
            <div
              className="actionbar only-sm"
              role="region"
              aria-label={t("Cambios aceptados", "Accepted changes")}
            >
              <span className="text-[13px]">
                {accepted.length === 1
                  ? t("1 cambio aceptado", "1 change accepted")
                  : t(
                      `${accepted.length} cambios aceptados`,
                      `${accepted.length} changes accepted`,
                    )}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() => void applyAndRecalculate()}
              >
                {analyzing
                  ? t("Recalculando…", "Recalculating…")
                  : t(`Aplicar ${accepted.length}`, `Apply ${accepted.length}`)}
              </button>
            </div>
          )}

          {tab === "missing" && (
            <OwnershipPanel
              ownership={ok.ownership}
              hasCollection={hasCollection}
              loggedIn={loggedIn}
              toCollection={
                loggedIn
                  ? {
                      all: [
                        ...ok.commanders.map((c) => collectionInput(c, 1)),
                        ...ok.cards.map((c) => collectionInput(c.card, c.quantity)),
                      ],
                      missing: ok.ownership.items
                        .filter((i) => i.toBuy > 0)
                        .map((i) =>
                          collectionInput(
                            [...ok.commanders, ...ok.cards.map((c) => c.card)].find(
                              (c) => c.oracleId === i.card.oracleId,
                            ) ?? i.card,
                            i.toBuy,
                          ),
                        ),
                      onDone: () => {
                        notifyCollectionChanged();
                        void analyze();
                      },
                    }
                  : undefined
              }
              wishlist={
                loggedIn && !owner && saved.deckId
                  ? {
                      on: inWishlist,
                      busy: busy === "wishlist",
                      onToggle: () => void toggleWishlist(),
                    }
                  : undefined
              }
            />
          )}

          {tab === "buy" && (
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

          <PrintingDialog
            card={printingCard}
            busy={busy !== null}
            onClose={() => setPrintingCard(null)}
            onPick={(p) => printingCard && void choosePrinting(printingCard, p)}
          />
          <RoleEditDialog
            card={editingRoles}
            busy={busy === "roles"}
            onClose={() => setEditingRoles(null)}
            canScopeToDeck={loggedIn && saved.deckId !== null}
            onSave={(edit, scope) => editingRoles && void saveRoles(editingRoles, edit, scope)}
          />
          {myNotes && (
            <>
              <CardNoteDialog
                deckId={myNotes.id}
                card={noteCard}
                text={noteCard ? (myNotes.cardNotes[noteCard.oracleId] ?? "") : ""}
                onClose={() => setNoteCard(null)}
                onSaved={(oracleId, text) => {
                  const cardNotes = { ...myNotes.cardNotes };
                  if (text) cardNotes[oracleId] = text;
                  else delete cardNotes[oracleId];
                  setExtra({ ...myNotes, cardNotes });
                }}
              />
              <DeckCompareDialog
                deckId={myNotes.id}
                open={comparing}
                onClose={() => setComparing(false)}
              />
            </>
          )}
          {saved.deckId !== null && !owner && (
            <DeckSettingsDialog
              open={dialog === "settings"}
              onClose={() => setDialog(null)}
              name={saved.name || ok.deckName || ""}
              visibility={saved.visibility}
              busy={busy === "settings"}
              onRename={(n) => void renameDeck(n)}
              onVisibility={(v) => void changeVisibility(v)}
              onDuplicate={() => setDialog("save")}
              onReplaceList={() => {
                setDialog(null);
                setEditing(true);
              }}
              onDelete={() => void deleteDeck()}
              deckId={saved.deckId}
              // La lista restaurada viene del servidor: se vuelve a abrir el mazo.
              onRestored={() => window.location.reload()}
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
      {/* Los comentarios van con la lista (no debajo de Estadísticas, Combos…). */}
      {deckId && saved.visibility !== "private" && (tab === "list" || tab === "missing") && (
        <DeckComments deckId={deckId} loggedIn={loggedIn} />
      )}
    </main>
  );
}

/** Los 12 temas más jugados y, si no está entre ellos, el elegido. */
function themeChips(themes: ThemeLink[], current: string): ThemeLink[] {
  const top = themes.slice(0, 12);
  if (current === "" || top.some((t) => t.slug === current)) return top;
  const known = themes.find((t) => t.slug === current);
  const name = current.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  return [...top, known ?? { slug: current, name, count: null }];
}

const compact = (n: number, intl: string) =>
  n >= 1000 ? `${(n / 1000).toLocaleString(intl, { maximumFractionDigits: 1 })}K` : String(n);

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
  onSample,
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
  /** Analizar el mazo de ejemplo (sustituye la lista). */
  onSample: () => void;
  openDeck: string | null;
  onCloseDeck: () => void;
}) {
  const t = useT();
  return (
    <>
      <h1 className="h1">{title}</h1>
      {!hasCollection && (
        <Banner
          tone="warn"
          action={
            <Link className="btn btn-sm" href="/collection">
              {t("Importar colección", "Import collection")}
            </Link>
          }
        >
          <b>{t("Aún no tengo tu colección.", "I don't have your collection yet.")}</b>{" "}
          <span className="muted">
            {t(
              "Puedo analizar el mazo y decirte qué le falta y qué comprar, pero para proponerte cambios con tus cartas sube el CSV de tu colección.",
              "I can analyze the deck and tell you what it's missing and what to buy, but to suggest changes with your cards, upload your collection CSV.",
            )}
          </span>
        </Banner>
      )}
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
          <nav
            className="tabs"
            style={{ padding: "0 6px" }}
            aria-label={t("Cómo darme el mazo", "How to give me the deck")}
          >
            {(["texto", "enlace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? "is-active" : ""}
                aria-pressed={mode === m}
                onClick={() => onMode(m)}
              >
                {m === "texto" ? t("Pegar lista", "Paste list") : t("Enlace", "Link")}
              </button>
            ))}
          </nav>
          <div className="flex flex-col gap-3.5 p-3.5">
            {mode === "texto" ? (
              <div className="field">
                <label className="label" htmlFor="lista">
                  {t("Lista", "List")}{" "}
                  <span className="subtle" style={{ fontWeight: 400 }}>
                    {t("(una carta por línea)", "(one card per line)")}
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
                  {t("Enlace del mazo", "Deck link")}
                </label>
                <input
                  id="url"
                  className="input mono"
                  type="url"
                  value={isLink(input) ? input : ""}
                  placeholder="https://…/decks/…"
                  onChange={(e) => onInput(e.target.value)}
                />
                <span className="hint">
                  {t(
                    "Enlace de un mazo público o sin listar.",
                    "Link to a public or unlisted deck.",
                  )}
                </span>
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
                  {t(
                    "No descontar cartas usadas en otros mazos",
                    "Don't discount cards used in other decks",
                  )}{" "}
                  <span className="subtle">
                    {t("— tratarlas como libres", "— treat them as free")}
                  </span>
                </span>
              </label>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
              {!openDeck && !onCancel && (
                <button
                  type="button"
                  className="btn btn-ghost mr-auto"
                  disabled={analyzing}
                  onClick={onSample}
                >
                  {t("Probar con un mazo de ejemplo", "Try a sample deck")}
                </button>
              )}
              {openDeck && (
                <button type="button" className="btn btn-ghost mr-auto" onClick={onCloseDeck}>
                  {t(`Cerrar «${openDeck}»`, `Close “${openDeck}”`)}
                </button>
              )}
              {onCancel && !analyzing && (
                <button type="button" className="btn btn-lg" onClick={onCancel}>
                  {t("Cancelar", "Cancel")}
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg full-sm"
                disabled={analyzing || !input.trim()}
              >
                {analyzing ? t("Analizando…", "Analyzing…") : t("Analizar", "Analyze")}
              </button>
            </div>
          </div>
          {analyzing && (
            <div className="border-t border-line px-3.5 py-3">
              <Loading>
                {t(
                  "Leyendo la lista y buscando recomendaciones…",
                  "Reading the list and fetching recommendations…",
                )}{" "}
                <span className="subtle">
                  {t(
                    "Luego lo cruzo con tu colección. Suele tardar unos segundos.",
                    "Then I match it against your collection. It usually takes a few seconds.",
                  )}
                </span>
              </Loading>
            </div>
          )}
        </form>
        <aside className="panel">
          <div className="panel-h">
            <span className="h2">{t("Cómo funciona", "How it works")}</span>
          </div>
          <div className="flex flex-col gap-2.5 p-3 text-[13px]">
            <p className="muted">
              {t(
                "Detecto el comandante, miro lo que juega la comunidad con él y te propongo cambios 1×1: qué carta sacar y cuál meter.",
                "I detect the commander, look at what the community plays with it and suggest 1-for-1 changes: which card to cut and which to add.",
              )}
            </p>
            <p className="muted">
              {t("Formatos:", "Formats:")} <span className="mono">1 Sol Ring</span>,{" "}
              <span className="mono">1x Sol Ring (C21) 263</span>, {t("secciones", "sections")}{" "}
              <span className="mono">Commander</span>/<span className="mono">Deck</span>{" "}
              {t("o", "or")} <span className="mono">*CMDR*</span>,{" "}
              {t("y enlaces de mazos públicos.", "and links to public decks.")}
            </p>
            <p className="muted">
              {t("¿No tienes la lista a mano?", "Don't have the list handy?")}{" "}
              <Link href="/decks/new">
                {t("Créalo desde un comandante", "Build it from a commander")}
              </Link>{" "}
              {t("con el mazo medio de la comunidad.", "with the community's average deck.")}
            </p>
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
  onPickOutside,
  busy,
}: {
  candidates: CardDTO[];
  chosen: string[];
  onToggle: (oracleId: string) => void;
  onConfirm: () => void;
  /** Elegir un comandante que no está en la lista (se añade a ella). Sin él, solo las candidatas. */
  onPickOutside?: ((card: CardDTO) => void) | undefined;
  busy: boolean;
}) {
  const t = useT();
  const outside = onPickOutside ? (
    <div
      className="flex flex-col gap-1.5 border-t border-line px-4 py-3.5"
      style={{ maxWidth: 520 }}
    >
      <CardSearch
        id="commander-outside"
        label={t("¿No está en la lista? Búscalo", "Not in the list? Search for it")}
        placeholder={t("Nombre del comandante", "Commander's name")}
        filters={{ commander: true }}
        onPick={onPickOutside}
      />
      <span className="hint">
        {t(
          "Se añade a la lista como comandante (si ya estaba en el mazo, pasa de allí al puesto de comandante).",
          "It's added to the list as the commander (if it was already in the deck, it moves to the commander slot).",
        )}
      </span>
    </div>
  ) : (
    <div className="px-4 pb-3.5">
      <span className="hint">
        {t(
          "Con un enlace, el comandante tiene que estar en el mazo. Si no, pega la lista como texto.",
          "With a link, the commander has to be in the deck. If it isn't, paste the list as text.",
        )}
      </span>
    </div>
  );
  const names = candidates.filter((c) => chosen.includes(c.oracleId)).map((c) => shortName(c.name));
  return (
    <section className="panel fade">
      <div className="panel-h stack-sm py-2">
        <span className="h2">{t("Elige el comandante", "Choose the commander")}</span>
        <span className="muted text-[13px]">
          {t(
            "La lista no lo marca. Candidatas encontradas:",
            "The list doesn't say. Candidates found:",
          )}{" "}
          {candidates.length}
        </span>
      </div>
      {candidates.length === 0 ? (
        <div className="p-4">
          <Banner tone="warn">
            {t(
              "No hay ninguna carta que pueda ser comandante en la lista. Búscalo abajo, o márcalo con una sección «Commander» o con",
              "There's no card in the list that can be a commander. Search for it below, or mark it with a “Commander” section or with",
            )}{" "}
            <span className="mono">*CMDR*</span>.
          </Banner>
        </div>
      ) : null}
      {candidates.length > 0 && (
        <>
          <div
            className="flex flex-wrap gap-4 p-4"
            role="group"
            aria-label={t("Candidatos a comandante", "Commander candidates")}
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
              {t(
                "Puedes elegir dos si son pareja (Partner, Background…).",
                "You can pick two if they're a pair (Partner, Background…).",
              )}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={chosen.length === 0 || busy}
              onClick={onConfirm}
            >
              {busy
                ? t("Analizando…", "Analyzing…")
                : names.length > 0
                  ? t(`Analizar con ${names.join(" + ")}`, `Analyze with ${names.join(" + ")}`)
                  : t("Elige uno", "Pick one")}
            </button>
          </div>
        </>
      )}
      {outside}
    </section>
  );
}

function DeckHeader({
  ok,
  name,
  owner,
  isSaved,
  onShowMissing,
  onSave,
  onSettings,
  onCompare,
  onExport,
  onEdit,
  target,
  bracket,
  onShowBracket,
  like,
  canLike,
  onLike,
}: {
  ok: Ok;
  name: string;
  owner: DeckViewDTO["owner"] | null;
  /** Mazo mío guardado: se guarda solo, el botón crea otro. */
  isSaved: boolean;
  onShowMissing: () => void;
  onSave: () => void;
  /** Ajustes del mazo (solo en uno mío guardado). */
  onSettings: () => void;
  /** Comparar con el mazo medio o con una versión anterior (solo en uno mío guardado). */
  onCompare: () => void;
  onExport: () => void;
  onEdit: () => void;
  target: Bracket | null;
  /** El estimado, con los combos si ya han llegado. */
  bracket: BracketEstimate;
  onShowBracket: () => void;
  like: { count: number; liked: boolean } | null;
  /** Solo el mazo de otro y con sesión. */
  canLike: boolean;
  onLike: () => void;
}) {
  const t = useT();
  const intl = useIntlLocale();
  const identity = [...new Set(ok.commanders.flatMap((c) => c.colorIdentity))];
  const order = ["W", "U", "B", "R", "G"];
  const commander = ok.commanders[0];
  // El arte recortado del comandante, de fondo (misma imagen en la carpeta art_crop de Scryfall).
  const art = commander?.imageUrl?.startsWith("/img/")
    ? commander.imageUrl.replace(/^\/img\/[a-z_]+\//, "/img/art_crop/").replace(/\.png$/, ".jpg")
    : null;
  return (
    <section
      className="deckhero stack-sm flex flex-wrap items-start gap-5"
      style={art ? { ["--art" as string]: `url("${art}")` } : undefined}
    >
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
              {t("Mazo de", "Deck by")}{" "}
              {owner.username ? (
                <Link href={`/u/${owner.username}`}>@{owner.username}</Link>
              ) : (
                owner.name
              )}{" "}
              · {t("comparado con tu colección", "compared with your collection")}
            </>
          ) : (
            <>
              Commander
              {ok.source !== "text"
                ? t(" · importado de un enlace", " · imported from a link")
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
          <BracketPill bracket={bracket} target={target} onClick={onShowBracket} />
        </div>
        <p className="subtle text-[13px]">
          {ok.totalCards} {t("cartas", "cards")} · {t("coste medio", "avg. mana value")}{" "}
          {averageCmc(ok.cards).toLocaleString(intl, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          {ok.edhrec.totalDecks !== null && (
            <>
              {" "}
              · {ok.edhrec.totalDecks.toLocaleString(intl)}{" "}
              {t("mazos analizados", "decks analyzed")}
            </>
          )}
        </p>
        <OwnershipLine ownership={ok.ownership} onClick={onShowMissing} />
      </div>
      <div className="flex flex-wrap gap-2">
        {isSaved && !owner ? (
          // Mío y guardado: se guarda solo; lo demás (duplicar, reemplazar, borrar…) en Ajustes.
          <>
            <button type="button" className="btn" onClick={onCompare}>
              {t("Comparar", "Compare")}
            </button>
            <button type="button" className="btn" onClick={onExport}>
              {t("Exportar", "Export")}
            </button>
            <button type="button" className="btn" onClick={onSettings}>
              <IconSettings size={15} />
              {t("Ajustes", "Settings")}
            </button>
          </>
        ) : (
          <>
            <div className="btn-group">
              <button type="button" className="btn" onClick={onSave}>
                {owner ? t("Copiar a mis mazos", "Copy to my decks") : t("Guardar", "Save")}
              </button>
              <button type="button" className="btn" onClick={onExport}>
                {t("Exportar", "Export")}
              </button>
            </div>
            {!owner && (
              <button type="button" className="btn btn-ghost" onClick={onEdit}>
                {t("Cambiar lista", "Change list")}
              </button>
            )}
          </>
        )}
        {like &&
          (canLike ? (
            <button
              type="button"
              className="btn"
              aria-pressed={like.liked}
              aria-label={like.liked ? t("Quitar «me gusta»", "Unlike") : t("Me gusta", "Like")}
              title={like.liked ? t("Quitar «me gusta»", "Unlike") : t("Me gusta", "Like")}
              onClick={onLike}
              style={like.liked ? { color: "var(--color-out)" } : undefined}
            >
              <IconHeart size={15} filled={like.liked} />
              {like.count}
            </button>
          ) : owner ? (
            <Link
              className="btn"
              href="/login"
              title={t("Entra para darle «me gusta»", "Sign in to like it")}
            >
              <IconHeart size={15} />
              {like.count}
            </Link>
          ) : (
            // Mi mazo: solo el dato, no un botón.
            <span
              className="subtle flex items-center gap-1.5 self-center text-[13px]"
              title={t("«Me gusta» de otros jugadores", "Likes from other players")}
            >
              <IconHeart size={14} />
              {like.count === 1
                ? t("1 me gusta", "1 like")
                : t(`${like.count} me gusta`, `${like.count} likes`)}
            </span>
          ))}
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
  const t = useT();
  const suggestions = ok.addCandidates.slice(0, 12);
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="h2">{t("Añadir cartas", "Add cards")}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? t("Ocultar", "Hide") : t("Mostrar", "Show")}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 p-3.5">
          <div style={{ maxWidth: 440 }}>
            <CardSearch
              id="deck-add"
              label={t(
                "Busca una carta (solo de los colores del comandante)",
                "Search for a card (commander's colors only)",
              )}
              filters={{ identity }}
              clearOnPick
              onPick={(card) => !busy && onAdd(card)}
            />
          </div>
          {notice && <span className="pill pill-in">{notice}</span>}
          {busy && (
            <span className="subtle text-xs">
              {t("Actualizando el mazo…", "Updating the deck…")}
            </span>
          )}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="label">
                {t(
                  "De tu colección, recomendadas para este comandante",
                  "From your collection, recommended for this commander",
                )}
              </span>
              <div className="chips">
                {suggestions.map((s) => (
                  <CardHover key={s.card.oracleId} card={s.card}>
                    <button
                      type="button"
                      className="chipbtn"
                      disabled={busy}
                      onClick={() => onAdd(s.card)}
                      aria-label={t(`Añadir ${s.card.name}`, `Add ${s.card.name}`)}
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

/**
 * "Tienes 72 de 99 · te faltan 27 (≈ 85 €)", que lleva a la pestaña "Qué me falta"; "· 4 en otros
 * mazos" abre cuáles y dónde.
 */
function OwnershipLine({
  ownership,
  onClick,
}: {
  ownership: Ok["ownership"];
  onClick: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { totals } = ownership;
  const [others, setOthers] = useState(false);
  const pct = totals.cards ? Math.round((totals.have / totals.cards) * 100) : 0;
  return (
    <div className="flex max-w-[420px] flex-col gap-1.5 rounded-md border border-line p-2">
      <span className="text-[13px]">
        <button type="button" onClick={onClick} className="linkbtn text-left no-underline">
          {t("Tienes", "You have")} <b className="mono">{totals.have}</b> {t("de", "of")}{" "}
          <b className="mono">{totals.cards}</b>
          {totals.toBuy > 0 ? (
            <>
              {" "}
              · {t("te faltan", "missing")}{" "}
              <b className="mono" style={{ color: "var(--color-out)" }}>
                {totals.toBuy}
              </b>{" "}
              <span className="muted">(≈ {formatEuros(totals.cost, locale)})</span>
            </>
          ) : totals.fromOtherDecks === 0 ? (
            <span className="pill pill-in"> · {t("lo tienes todo", "you have it all")}</span>
          ) : null}
        </button>
        {totals.fromOtherDecks > 0 && (
          <>
            <span className="muted"> · </span>
            <button
              type="button"
              className="linkbtn underline decoration-dotted underline-offset-2"
              style={{ color: "var(--color-inuse)" }}
              onClick={() => setOthers(true)}
            >
              {totals.fromOtherDecks} {t("en otros mazos", "in other decks")}
            </button>
          </>
        )}
      </span>
      <div className="role-bar" style={{ height: 4 }} aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>
      {others && <OtherDecksDialog items={ownership.items} onClose={() => setOthers(false)} />}
    </div>
  );
}

/** Mientras se abre un mazo guardado: la forma de la cabecera y del diff, sin la lista. */
function OpeningDeck() {
  const t = useT();
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
        {t(
          "Abriendo el mazo y comparándolo con tu colección…",
          "Opening the deck and comparing it with your collection…",
        )}{" "}
        <span className="subtle">
          {t(
            "Busco las recomendaciones; suele tardar unos segundos.",
            "Fetching the recommendations; it usually takes a few seconds.",
          )}
        </span>
      </Loading>
      <DiffSkeleton />
    </div>
  );
}

/** Avisos del análisis, plegados en una línea. */
function Issues({ ok }: { ok: Ok }) {
  const t = useT();
  const items: string[] = [
    ...ok.issues.map((i) => i.message),
    ...ok.unresolved.map((n) =>
      t(`«${n}» no la encuentro en el catálogo.`, `I can't find “${n}” in the catalog.`),
    ),
    ...ok.skipped.map((s) =>
      t(
        `Línea ${s.line} ignorada: ${s.text.trim()} (${s.reason}).`,
        `Line ${s.line} skipped: ${s.text.trim()}.`,
      ),
    ),
    ...(ok.edhrec.warning ? [ok.edhrec.warning] : []),
  ];
  if (items.length === 0) return null;
  return (
    <details className="issues">
      <summary>
        <IconWarn size={15} style={{ color: "var(--color-warn)" }} />
        <span>
          <b>
            {items.length === 1
              ? t("1 cosa que revisar", "1 thing to check")
              : t(`${items.length} cosas que revisar`, `${items.length} things to check`)}
          </b>{" "}
          <span className="muted">— {items[0]}</span>
        </span>
      </summary>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

function NoSwaps({ hasCollection }: { hasCollection: boolean }) {
  const t = useT();
  return (
    <div className="panel flex flex-col items-center gap-2 px-5 py-8 text-center">
      <span className="h2">{t("No hay cambios que proponer", "No changes to suggest")}</span>
      <span className="muted max-w-[420px] text-[13px]">
        {hasCollection
          ? t(
              "Ninguna carta de tu colección mejora el mazo con la configuración actual. Prueba otro tema o la pestaña «Mejorar comprando».",
              "No card in your collection improves the deck with the current settings. Try another theme or the “Improve by buying” tab.",
            )
          : t(
              "Sin tu colección no sé qué cartas tienes. Impórtala, o mira la pestaña «Mejorar comprando».",
              "Without your collection I don't know which cards you have. Import it, or check the “Improve by buying” tab.",
            )}
      </span>
      {!hasCollection && (
        <Link className="btn btn-primary" href="/collection">
          {t("Importar colección", "Import collection")}
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
  const t = useT();
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">{t("En otros mazos", "In other decks")}</span>
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
          {t("Proponerlas igualmente", "Suggest them anyway")}
        </label>
      </div>
    </div>
  );
}
