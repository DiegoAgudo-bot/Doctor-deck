"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CardDTO } from "@/server/dto";
import type { LoanDTO, LoansDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { CardSearch } from "./card-search";
import { memberLabel, MemberLink, playedOn } from "./games-ui";
import { IconPlus, IconTrash } from "./icons";
import { NOTIFICATIONS_EVENT } from "./local-collection";
import { ago, Banner, Dialog, EmptyState, Loading } from "./ui";

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Prestar copias de una carta. Con `card` ya elegida (desde la colección o un grupo) o, si es
 * null y `open`, buscándola.
 */
export function LendDialog({
  card: initial,
  open = initial !== null,
  onClose,
  onDone,
}: {
  card: CardDTO | null;
  open?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [card, setCard] = useState<CardDTO | null>(initial);
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se reinicia al abrir
    setCard(initial);
    setError(null);
    setQuantity(1);
  }, [initial, open]);

  async function save() {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/loans", {
        method: "POST",
        ...json({ oracleId: card.oracleId, quantity, to, note: note || undefined }),
      });
      setTo("");
      setNote("");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo apuntar el préstamo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Prestar una carta"
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !card || !to.trim()}
            onClick={() => void save()}
          >
            Apuntar préstamo
          </button>
        </>
      }
    >
      {error && <Banner tone="out">{error}</Banner>}
      {card ? (
        <div className="flex items-center gap-3">
          <div className="w-[64px] flex-none">
            <CardImage card={card} />
          </div>
          <div className="flex flex-col gap-1">
            <b>{card.name}</b>
            {!initial && (
              <button
                type="button"
                className="linkbtn self-start text-xs"
                onClick={() => setCard(null)}
              >
                Otra carta
              </button>
            )}
          </div>
        </div>
      ) : (
        <CardSearch id="lend-card" label="Carta" onPick={setCard} autoFocus />
      )}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "minmax(0, 1fr) 90px" }}>
        <label className="field">
          <span className="label">A quién</span>
          <input
            className="input"
            placeholder="@usuario o un nombre"
            value={to}
            maxLength={60}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">Copias</span>
          <input
            className="input"
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          />
        </label>
      </div>
      <label className="field">
        <span className="label">Nota (opcional)</span>
        <input
          className="input"
          placeholder="Para el torneo del sábado"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <p className="subtle text-xs">
        Sigue siendo tuya, pero mientras no te la devuelvan cuenta como ocupada: no se propone en
        tus mazos ni sale en tu lista para cambiar. Con @usuario, le llega un aviso.
      </p>
    </Dialog>
  );
}

function LoanRow({
  loan,
  mine,
  onReturned,
  onDelete,
}: {
  loan: LoanDTO;
  mine: boolean;
  onReturned: () => void;
  onDelete: () => void;
}) {
  const who = mine
    ? loan.borrower
      ? memberLabel(loan.borrower)
      : (loan.borrowerName ?? "")
    : memberLabel(loan.lender);
  return (
    <li className={`loanrow ${loan.returnedAt ? "is-returned" : ""}`}>
      <div className="w-[46px] flex-none">
        {loan.card && <CardImage card={loan.card} sizes="46px" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="truncate">
          {loan.quantity > 1 && <span className="mono">{loan.quantity}× </span>}
          {loan.name}
        </b>
        <span className="subtle text-xs">
          {mine ? "A " : "De "}
          {mine && loan.borrower ? (
            <MemberLink m={loan.borrower} />
          ) : !mine ? (
            <MemberLink m={loan.lender} />
          ) : (
            who
          )}
          {" · "}
          {ago(loan.createdAt)}
          {loan.returnedAt ? ` · devuelta el ${playedOn(loan.returnedAt)}` : ""}
        </span>
        {loan.note && <span className="muted truncate text-[12.5px]">{loan.note}</span>}
      </div>
      {!loan.returnedAt && (
        <button type="button" className="btn btn-sm" onClick={onReturned}>
          {mine ? "Me la devolvió" : "Ya la devolví"}
        </button>
      )}
      {mine && (
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Borrar el préstamo"
          title="Borrar (si lo apuntaste por error)"
          onClick={onDelete}
        >
          <IconTrash size={13} />
        </button>
      )}
    </li>
  );
}

/** /loans: lo que he prestado y lo que me han prestado. */
export function LoansPage() {
  const [loans, setLoans] = useState<LoansDTO | null>(null);
  const [all, setAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lending, setLending] = useState(false);

  const load = useCallback(() => {
    api<LoansDTO>(`/api/loans${all ? "?all=1" : ""}`)
      .then(setLoans)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo cargar"));
  }, [all]);
  useEffect(load, [load]);

  const act = (l: LoanDTO, del: boolean) =>
    void api(
      `/api/loans/${l.id}`,
      del ? { method: "DELETE" } : { method: "PATCH", ...json({ action: "returned" }) },
    )
      .then(() => {
        load();
        window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudo guardar"));

  return (
    <main className="page">
      <div className="stack-sm flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <span className="eyebrow">Entre amigos</span>
          <h1 className="h1">Préstamos</h1>
          <p className="muted text-[13px]">
            Las cartas que has dejado y las que te han dejado. Las prestadas siguen en tu colección
            pero cuentan como ocupadas.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setLending(true)}>
          <IconPlus size={14} /> Prestar una carta
        </button>
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!loans && !error && <Loading>Cargando préstamos…</Loading>}
      {loans && (
        <>
          <label className="check self-start">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Ver también los devueltos
          </label>
          <div
            className="grid-1-sm grid gap-4"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            <section className="flex flex-col gap-2">
              <h2 className="h2">
                He prestado{" "}
                <span className="subtle">{loans.lent.filter((l) => !l.returnedAt).length}</span>
              </h2>
              {loans.lent.length === 0 ? (
                <div className="panel">
                  <EmptyState title="No tienes nada prestado">
                    Apunta aquí lo que dejas para no perderle la pista.
                  </EmptyState>
                </div>
              ) : (
                <ul className="panel loanlist">
                  {loans.lent.map((l) => (
                    <LoanRow
                      key={l.id}
                      loan={l}
                      mine
                      onReturned={() => act(l, false)}
                      onDelete={() => act(l, true)}
                    />
                  ))}
                </ul>
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="h2">
                Me han prestado{" "}
                <span className="subtle">{loans.borrowed.filter((l) => !l.returnedAt).length}</span>
              </h2>
              {loans.borrowed.length === 0 ? (
                <div className="panel">
                  <EmptyState title="Nadie te ha dejado nada">
                    Cuando alguien te preste una carta con tu usuario, aparecerá aquí.{" "}
                    <Link href="/groups">Busca en tus grupos</Link> quién tiene lo que te falta.
                  </EmptyState>
                </div>
              ) : (
                <ul className="panel loanlist">
                  {loans.borrowed.map((l) => (
                    <LoanRow
                      key={l.id}
                      loan={l}
                      mine={false}
                      onReturned={() => act(l, false)}
                      onDelete={() => undefined}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
      <LendDialog
        card={null}
        open={lending}
        onClose={() => setLending(false)}
        onDone={() => {
          setLending(false);
          load();
        }}
      />
    </main>
  );
}
