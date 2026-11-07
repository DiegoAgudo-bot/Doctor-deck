"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ProposalStatusDTO, TradeCalculatorDTO, TradeProposalDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { linesForApi, toLines, TradeEditor, type TradeLine } from "./trade-editor";
import { Banner, Dialog, Loading, ago } from "./ui";
import { Link, useLocale, useRouter, useT, type T } from "@/components/i18n";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export const statusLabel = (s: ProposalStatusDTO, t: T) =>
  ({
    draft: t("Borrador", "Draft"),
    pending: t("Pendiente", "Pending"),
    accepted: t("Hecho", "Done"),
    rejected: t("Rechazada", "Rejected"),
    cancelled: t("Retirada", "Withdrawn"),
  })[s];

/** /trades/with/{username}: la calculadora con otro usuario. */
export function TradeCalculatorPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const t = useT();
  const [calc, setCalc] = useState<TradeCalculatorDTO | null>(null);
  const [lines, setLines] = useState<TradeLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<TradeCalculatorDTO>(`/api/trades/calculator?username=${encodeURIComponent(username)}`)
      .then((c) => {
        setCalc(c);
        setLines(toLines(c.give, c.get));
      })
      .catch((e: unknown) =>
        setError(
          errorText(e, t("No se pudo preparar el intercambio", "Couldn't prepare the trade")),
        ),
      );
  }, [username, t]);

  async function create(send: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/trades/proposals", {
        method: "POST",
        ...json({ username, lines: linesForApi(lines), send }),
      });
      router.push(`/trades/proposals/${id}`);
    } catch (e) {
      setError(errorText(e, t("No se pudo guardar la propuesta", "Couldn't save the proposal")));
      setBusy(false);
    }
  }

  const empty = !lines.some((l) => l.quantity > 0);
  return (
    <main className="page" style={{ gap: 16 }}>
      <div className="flex flex-col gap-1">
        <Link className="subtle text-[13px]" href="/trades">
          ← {t("Intercambios", "Trades")}
        </Link>
        <h1 className="h1">
          {t("Intercambio con", "Trade with")} @{username}
        </h1>
        <p className="muted text-[13px]">
          {t(
            `Propuesta inicial: lo que tienes para cambiar que @${username} busca, y al revés, ya cuadrada por valor (precio de cada copia según su edición y si es foil). Ajústala y envíasela: podrá aceptarla, rechazarla o contraproponer.`,
            `Starting proposal: what you have for trade that @${username} wants, and the other way round, already balanced by value (each copy's price by printing and foil). Adjust it and send it: they can accept, reject or counter.`,
          )}
        </p>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!calc && !error && (
        <Loading>{t("Cruzando vuestras listas…", "Matching your lists…")}</Loading>
      )}
      {calc && (
        <>
          {calc.openProposalId && (
            <Banner tone="info">
              {t("Ya tenéis una propuesta abierta.", "You already have an open proposal.")}{" "}
              <Link href={`/trades/proposals/${calc.openProposalId}`}>
                {t("Ver la propuesta", "See the proposal")}
              </Link>
            </Banner>
          )}
          {calc.give.length === 0 && calc.get.length === 0 && (
            <Banner tone="info">
              {t(
                "Vuestras listas no cruzan ahora mismo. Puedes montar el intercambio a mano con «Añadir más».",
                "Your lists don't match right now. You can put the trade together by hand with “Add more”.",
              )}
            </Banner>
          )}
          <TradeEditor
            partner={username}
            lines={lines}
            onChange={setLines}
            myCopies={calc.myCopies}
            theirCopies={calc.theirCopies}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn"
              disabled={busy || empty}
              onClick={() => void create(false)}
            >
              {t("Guardar borrador", "Save draft")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || empty}
              onClick={() => void create(true)}
            >
              {busy ? t("Enviando…", "Sending…") : `${t("Enviar a", "Send to")} @${username}`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

/** /trades/proposals/{id}: ver, editar, contraproponer, aceptar o rechazar. */
export function TradeProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [p, setP] = useState<TradeProposalDTO | null>(null);
  const [lines, setLines] = useState<TradeLine[]>([]);
  /** Contraproponiendo: editando las líneas de una propuesta que me toca responder. */
  const [countering, setCountering] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const show = useCallback((d: TradeProposalDTO) => {
    setP(d);
    setLines(toLines(d.give, d.get));
    setCountering(false);
  }, []);
  useEffect(() => {
    api<TradeProposalDTO>(`/api/trades/proposals/${encodeURIComponent(id)}`)
      .then(show)
      .catch((e: unknown) =>
        setError(errorText(e, t("No se pudo cargar la propuesta", "Couldn't load the proposal"))),
      );
  }, [id, show, t]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<TradeProposalDTO | { deleted: true }>(
        `/api/trades/proposals/${encodeURIComponent(id)}`,
        { method: "PATCH", ...json(body) },
      );
      if ("deleted" in res) router.push("/trades?tab=proposals");
      else show(res);
    } catch (e) {
      setError(errorText(e, t("No se pudo completar la acción", "Couldn't complete the action")));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  if (!p) {
    return (
      <main className="page">
        {error ? (
          <Banner tone="out">{error}</Banner>
        ) : (
          <Loading>{t("Cargando la propuesta…", "Loading the proposal…")}</Loading>
        )}
      </main>
    );
  }

  const partner = p.partner.username;
  const editing = p.actions.edit || countering;
  const empty = !lines.some((l) => l.quantity > 0);
  const who =
    p.status === "pending"
      ? p.myTurn
        ? t("Te toca responder", "Your turn to answer")
        : t(`Le toca a @${partner}`, `@${partner}'s turn`)
      : null;

  return (
    <main className="page" style={{ gap: 16 }}>
      <div className="flex flex-col gap-1">
        <Link className="subtle text-[13px]" href="/trades?tab=proposals">
          ← {t("Propuestas", "Proposals")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="h1">
            {t("Intercambio con", "Trade with")} @{partner}
          </h1>
          <span
            className={`pill ${p.status === "accepted" ? "pill-in" : p.status === "pending" ? "pill-warn" : ""}`}
          >
            {statusLabel(p.status, t)}
          </span>
          {p.version > 1 && (
            <span className="pill subtle">
              {t("versión", "version")} {p.version}
            </span>
          )}
        </div>
        <p className="muted text-[13px]">
          {p.isMine
            ? t("La propusiste tú", "You proposed it")
            : t(`Te la propuso @${partner}`, `Proposed by @${partner}`)}
          {p.version > 1 &&
            (p.lastByMe
              ? t(" · la última versión es tuya", " · the latest version is yours")
              : t(` · última versión de @${partner}`, ` · latest version by @${partner}`))}
          {" · "}
          {ago(p.updatedAt, locale)}
          {who && (
            <>
              {" "}
              · <b>{who}</b>
            </>
          )}
        </p>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {p.unavailable.length > 0 && (p.status === "pending" || p.status === "draft") && (
        <Banner tone="warn">
          {t(
            "Algunas cartas ya no están en la lista para cambiar de quien las da (marcadas abajo).",
            "Some cards are no longer on the giver's trade list (marked below).",
          )}
          {p.myTurn
            ? t(" Contrapropón sin ellas o recházala.", " Counter without them or reject it.")
            : ""}
        </Banner>
      )}
      {p.status === "accepted" && (
        <Banner tone="in">
          {t(
            "Intercambio hecho: las cartas ya se han movido entre vuestras colecciones de Doctor Deck.",
            "Trade done: the cards have been moved between your Doctor Deck collections.",
          )}
        </Banner>
      )}

      <TradeEditor
        partner={partner}
        lines={lines}
        onChange={editing ? setLines : undefined}
        myCopies={p.myCopies}
        theirCopies={p.theirCopies}
        unavailable={p.unavailable}
      />

      <div className="flex flex-wrap justify-end gap-2">
        {p.actions.edit && (
          <>
            <button
              type="button"
              className="btn btn-ghost mr-auto"
              disabled={busy}
              onClick={() => void act({ action: "delete" })}
            >
              {t("Borrar borrador", "Delete draft")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || empty}
              onClick={() => void act({ action: "save", lines: linesForApi(lines) })}
            >
              {t("Guardar", "Save")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || empty}
              onClick={() => void act({ action: "send", lines: linesForApi(lines) })}
            >
              {t("Enviar a", "Send to")} @{partner}
            </button>
          </>
        )}
        {p.actions.cancel && !countering && (
          <button
            type="button"
            className="btn btn-ghost mr-auto"
            disabled={busy}
            onClick={() => void act({ action: "cancel" })}
          >
            {t("Retirar", "Withdraw")}
          </button>
        )}
        {p.actions.respond && !countering && (
          <>
            <button
              type="button"
              className="btn btn-out"
              disabled={busy}
              onClick={() => void act({ action: "reject" })}
            >
              {t("Rechazar", "Reject")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setCountering(true)}
            >
              {t("Contraproponer", "Counter")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || p.unavailable.length > 0}
              onClick={() => setConfirm(true)}
            >
              {t("Aceptar", "Accept")}
            </button>
          </>
        )}
        {countering && (
          <>
            <button
              type="button"
              className="btn mr-auto"
              disabled={busy}
              onClick={() => {
                setLines(toLines(p.give, p.get));
                setCountering(false);
              }}
            >
              {t("Cancelar cambios", "Discard changes")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || empty}
              onClick={() => void act({ action: "counter", lines: linesForApi(lines) })}
            >
              {t("Enviar contrapropuesta", "Send counteroffer")}
            </button>
          </>
        )}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("Aceptar el intercambio", "Accept the trade")}
        width={460}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void act({ action: "accept" })}
            >
              {busy
                ? t("Moviendo cartas…", "Moving cards…")
                : t("Aceptar y mover las cartas", "Accept and move the cards")}
            </button>
          </>
        }
      >
        <p className="text-[13.5px]">
          {t(
            `Las cartas que das saldrán de tu colección y las que recibes entrarán en ella (y al revés en la de @${partner}). No se puede deshacer.`,
            `The cards you give will leave your collection and the ones you get will enter it (and the other way round in @${partner}'s). This can't be undone.`,
          )}
        </p>
        <p className="subtle text-xs">
          {t(
            "Si después vuelves a importar un CSV antiguo de tu colección, las cartas que has dado volverían a aparecer: a partir de ahora, lleva tu colección en Doctor Deck.",
            "If you later import an old CSV of your collection, the cards you gave would come back: from now on, keep your collection in Doctor Deck.",
          )}
        </p>
      </Dialog>
    </main>
  );
}
