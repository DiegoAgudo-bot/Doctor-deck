"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ProposalStatusDTO, TradeCalculatorDTO, TradeProposalDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { linesForApi, toLines, TradeEditor, type TradeLine } from "./trade-editor";
import { Banner, Dialog, Loading, ago } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export const STATUS_LABEL: Record<ProposalStatusDTO, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  accepted: "Hecho",
  rejected: "Rechazada",
  cancelled: "Retirada",
};

/** /intercambios/con/{username}: la calculadora con otro usuario. */
export function TradeCalculatorPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
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
      .catch((e: unknown) => setError(errorText(e, "No se pudo preparar el intercambio")));
  }, [username]);

  async function create(send: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/trades/proposals", {
        method: "POST",
        ...json({ username, lines: linesForApi(lines), send }),
      });
      router.push(`/intercambios/propuestas/${id}`);
    } catch (e) {
      setError(errorText(e, "No se pudo guardar la propuesta"));
      setBusy(false);
    }
  }

  const empty = !lines.some((l) => l.quantity > 0);
  return (
    <main className="page max-w-[1100px]" style={{ gap: 16 }}>
      <div className="flex flex-col gap-1">
        <Link className="subtle text-[13px]" href="/intercambios">
          ← Intercambios
        </Link>
        <h1 className="h1">Intercambio con @{username}</h1>
        <p className="muted text-[13px]">
          Propuesta inicial: lo que tienes para cambiar que @{username} busca, y al revés, ya
          cuadrada por valor (precio de cada copia según su edición y si es foil). Ajústala y
          envíasela: podrá aceptarla, rechazarla o contraproponer.
        </p>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!calc && !error && <Loading>Cruzando vuestras listas…</Loading>}
      {calc && (
        <>
          {calc.openProposalId && (
            <Banner tone="info">
              Ya tenéis una propuesta abierta.{" "}
              <Link href={`/intercambios/propuestas/${calc.openProposalId}`}>Ver la propuesta</Link>
            </Banner>
          )}
          {calc.give.length === 0 && calc.get.length === 0 && (
            <Banner tone="info">
              Vuestras listas no cruzan ahora mismo. Puedes montar el intercambio a mano con
              &laquo;Añadir más&raquo;.
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
              Guardar borrador
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || empty}
              onClick={() => void create(true)}
            >
              {busy ? "Enviando…" : `Enviar a @${username}`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

/** /intercambios/propuestas/{id}: ver, editar, contraproponer, aceptar o rechazar. */
export function TradeProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
      .catch((e: unknown) => setError(errorText(e, "No se pudo cargar la propuesta")));
  }, [id, show]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<TradeProposalDTO | { deleted: true }>(
        `/api/trades/proposals/${encodeURIComponent(id)}`,
        { method: "PATCH", ...json(body) },
      );
      if ("deleted" in res) router.push("/intercambios?tab=propuestas");
      else show(res);
    } catch (e) {
      setError(errorText(e, "No se pudo completar la acción"));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  if (!p) {
    return (
      <main className="page max-w-[1100px]">
        {error ? <Banner tone="out">{error}</Banner> : <Loading>Cargando la propuesta…</Loading>}
      </main>
    );
  }

  const partner = p.partner.username;
  const editing = p.actions.edit || countering;
  const empty = !lines.some((l) => l.quantity > 0);
  const who =
    p.status === "pending" ? (p.myTurn ? "Te toca responder" : `Le toca a @${partner}`) : null;

  return (
    <main className="page max-w-[1100px]" style={{ gap: 16 }}>
      <div className="flex flex-col gap-1">
        <Link className="subtle text-[13px]" href="/intercambios?tab=propuestas">
          ← Propuestas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="h1">Intercambio con @{partner}</h1>
          <span
            className={`pill ${p.status === "accepted" ? "pill-in" : p.status === "pending" ? "pill-warn" : ""}`}
          >
            {STATUS_LABEL[p.status]}
          </span>
          {p.version > 1 && <span className="pill subtle">versión {p.version}</span>}
        </div>
        <p className="muted text-[13px]">
          {p.isMine ? "La propusiste tú" : `Te la propuso @${partner}`}
          {p.version > 1 &&
            (p.lastByMe ? " · la última versión es tuya" : ` · última versión de @${partner}`)}
          {" · "}
          {ago(p.updatedAt)}
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
          Algunas cartas ya no están en la lista para cambiar de quien las da (marcadas abajo).
          {p.myTurn ? " Contrapropón sin ellas o recházala." : ""}
        </Banner>
      )}
      {p.status === "accepted" && (
        <Banner tone="in">
          Intercambio hecho: las cartas ya se han movido entre vuestras colecciones de Deck Doctor.
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
              Borrar borrador
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || empty}
              onClick={() => void act({ action: "save", lines: linesForApi(lines) })}
            >
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || empty}
              onClick={() => void act({ action: "send", lines: linesForApi(lines) })}
            >
              Enviar a @{partner}
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
            Retirar
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
              Rechazar
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setCountering(true)}
            >
              Contraproponer
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || p.unavailable.length > 0}
              onClick={() => setConfirm(true)}
            >
              Aceptar
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
              Cancelar cambios
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || empty}
              onClick={() => void act({ action: "counter", lines: linesForApi(lines) })}
            >
              Enviar contrapropuesta
            </button>
          </>
        )}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Aceptar el intercambio"
        width={460}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void act({ action: "accept" })}
            >
              {busy ? "Moviendo cartas…" : "Aceptar y mover las cartas"}
            </button>
          </>
        }
      >
        <p className="text-[13.5px]">
          Las cartas que das saldrán de tu colección y las que recibes entrarán en ella (y al revés
          en la de @{partner}). No se puede deshacer.
        </p>
        <p className="subtle text-xs">
          Si después vuelves a importar un CSV de ManaBox antiguo, las cartas que has dado volverían
          a aparecer: a partir de ahora, lleva tu colección en Deck Doctor.
        </p>
      </Dialog>
    </main>
  );
}
