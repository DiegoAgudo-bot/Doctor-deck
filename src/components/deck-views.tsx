"use client";

import { useState } from "react";
import { ROLE_LABELS, ROLES, type Role } from "@/domain/roles/types";
import type { CardDTO, DeckCardDTO, RoleStatDTO, ScoredCardDTO, SwapDTO } from "@/server/dto";
import { CardHover, CardImage } from "./card-image";
import { IconArrowRight, IconChevron, IconLock, IconMinus, IconPlus, IconX } from "./icons";
import { ManaCost } from "./mana";

export type Decision = "accepted" | "rejected";

const pct = (x: number) => `${Math.round(x * 100)} %`;
const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)} %`;
/** Mejora de la puntuación del motor, con un decimal ("4,4"). */
export const points = (score: number) => score.toFixed(1).replace(".", ",");
/** Las etiquetas de rol van en minúscula (se usan dentro de frases); en la interfaz, con mayúscula. */
export const roleLabel = (role: Role) => {
  const l = ROLE_LABELS[role];
  return l.charAt(0).toUpperCase() + l.slice(1);
};
const isLand = (c: Pick<CardDTO, "typeLine">) => /\bLand\b/.test(c.typeLine.split("//")[0] ?? "");

// ---------- Cambios (diff) ----------

function SwapRow({ sign, scored }: { sign: "−" | "+"; scored: ScoredCardDTO }) {
  const { card } = scored;
  return (
    <CardHover card={card} as="div" className={`diff-row ${sign === "−" ? "minus" : "plus"}`}>
      <span className="sign" aria-label={sign === "−" ? "Sale" : "Entra"}>
        {sign}
      </span>
      <span className="nm" style={sign === "+" ? { fontWeight: 500 } : undefined}>
        1 {card.name}
      </span>
      <span className="flex items-center gap-3">
        <ManaCost cost={card.manaCost} />
        {scored.price !== undefined && (
          <span className="mono subtle hide-sm w-14 text-right text-xs">
            {scored.price.toFixed(2).replace(".", ",")} €
          </span>
        )}
      </span>
    </CardHover>
  );
}

function ownedLabel(s: ScoredCardDTO): string | null {
  if (s.available === undefined) return null;
  return s.available === 1 ? "Tienes 1 libre" : `Tienes ${s.available} libres`;
}

/** Un cambio: "− sale / + entra", con su puntuación, datos de EDHREC y motivo. */
export function SwapDiff({
  swap,
  decision,
  onDecide,
  commanderName,
}: {
  swap: SwapDTO;
  decision: Decision | undefined;
  onDecide: (d: Decision | undefined) => void;
  commanderName: string;
}) {
  const [open, setOpen] = useState(false);
  const role = roleLabel(swap.in.primaryRole);
  const owned = ownedLabel(swap.in);
  const cls =
    decision === "accepted" ? "is-accepted" : decision === "rejected" ? "is-discarded" : "";
  return (
    <div className={`diff-item ${cls}`}>
      <div className="diff-hunk">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          style={{ width: 24, height: 24 }}
          aria-label={open ? "Ocultar las cartas" : "Ver las cartas"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <IconChevron
            size={14}
            style={{
              transform: `rotate(${open ? 90 : 0}deg)`,
              transition: "transform var(--motion-150) var(--ease-out)",
            }}
          />
        </button>
        <span className="pill">{role}</span>
        {owned && (
          <span className="muted hide-sm flex items-center gap-1.5">
            <span className="dot dot-owned" />
            {owned}
          </span>
        )}
        <span className="score ml-auto" title="Mejora de la puntuación">
          +{points(swap.score)}
        </span>
        {decision ? (
          <span className="flex items-center gap-2">
            <span className={decision === "accepted" ? "pill pill-in" : "pill subtle"}>
              {decision === "accepted" ? "Aceptado" : "Descartado"}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDecide(undefined)}
            >
              Deshacer
            </button>
          </span>
        ) : (
          <span className="flex gap-1">
            <button
              type="button"
              className="btn btn-in btn-sm"
              onClick={() => onDecide("accepted")}
            >
              Aceptar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ width: 26, height: 26 }}
              aria-label={`Descartar ${swap.in.card.name}`}
              onClick={() => onDecide("rejected")}
            >
              <IconX size={13} />
            </button>
          </span>
        )}
      </div>
      <SwapRow sign="−" scored={swap.out} />
      <SwapRow sign="+" scored={swap.in} />
      <div className="diff-meta">
        {swap.in.synergy !== null && (
          <span>
            Sinergia <b className="mono">{signedPct(swap.in.synergy)}</b>
          </span>
        )}
        {swap.in.inclusion !== null && (
          <span>
            En el <b className="mono">{pct(swap.in.inclusion)}</b> de los mazos de {commanderName}
          </span>
        )}
        <span>{swap.reason}</span>
      </div>
      {open && (
        <div className="fade flex flex-wrap items-center gap-3.5 border-b border-line py-3.5 pr-3 pl-[42px]">
          <CardImage card={swap.out.card} style={{ width: 190, opacity: 0.7 }} />
          <IconArrowRight size={22} className="text-text-3" />
          <CardImage card={swap.in.card} style={{ width: 190 }} />
        </div>
      )}
    </div>
  );
}

/** Esqueleto del diff mientras se analiza. */
export function DiffSkeleton() {
  return (
    <div className="diff" aria-hidden="true">
      {[40, 35].map((w, i) => (
        <div key={i}>
          <div className="diff-hunk">
            <div className="skel" style={{ width: 70, height: 12 }} />
            <div className="skel ml-auto" style={{ width: 30, height: 12 }} />
          </div>
          <div className="diff-row minus">
            <span className="sign">−</span>
            <div className="skel" style={{ height: 11, width: `${w}%` }} />
            <span />
          </div>
          <div className="diff-row plus">
            <span className="sign">+</span>
            <div className="skel" style={{ height: 11, width: `${w + 15}%` }} />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Estadísticas ----------

type Seg = "w" | "u" | "b" | "r" | "g" | "m" | "c";
const SEG_LABEL: Record<Seg, string> = {
  w: "Blanco",
  u: "Azul",
  b: "Negro",
  r: "Rojo",
  g: "Verde",
  m: "Multicolor",
  c: "Incoloro",
};
const SEG_ORDER: Seg[] = ["w", "u", "b", "r", "g", "m", "c"];

function segOf(card: CardDTO): Seg {
  if (card.colorIdentity.length === 0) return "c";
  if (card.colorIdentity.length > 1) return "m";
  return (card.colorIdentity[0] ?? "C").toLowerCase() as Seg;
}

/** Curva de maná de las cartas que no son tierra, apilada por color (identidad de cada carta). */
export function ManaCurve({ cards }: { cards: { card: CardDTO; quantity: number }[] }) {
  const cols = Array.from({ length: 8 }, () => new Map<Seg, number>());
  let spells = 0;
  for (const { card, quantity } of cards) {
    if (isLand(card)) continue;
    const bucket = Math.min(7, Math.max(0, Math.floor(card.cmc)));
    const col = cols[bucket];
    if (!col) continue;
    const seg = segOf(card);
    col.set(seg, (col.get(seg) ?? 0) + quantity);
    spells += quantity;
  }
  const totals = cols.map((c) => [...c.values()].reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals);
  const used = SEG_ORDER.filter((s) => cols.some((c) => c.has(s)));
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">Curva de maná</span>
        <span className="mono subtle text-xs">{spells} hechizos</span>
      </div>
      <div className="p-3">
        <div
          className="curve"
          role="img"
          aria-label={`Curva de maná: ${totals.map((t, i) => `${i === 7 ? "7+" : i}: ${t}`).join(", ")}`}
        >
          {cols.map((col, i) => (
            <div key={i} className="curve-col">
              <span className="curve-n">{totals[i] || ""}</span>
              <div
                className="curve-stack"
                style={{
                  height: `${((totals[i] ?? 0) / max) * 78}%`,
                  ["--d" as string]: `${i * 30}ms`,
                }}
              >
                {SEG_ORDER.filter((s) => col.has(s)).map((s) => (
                  <div
                    key={s}
                    className={`seg-${s}`}
                    style={{ height: `${((col.get(s) ?? 0) / (totals[i] || 1)) * 100}%` }}
                  />
                ))}
              </div>
              <span className="curve-x">{i === 7 ? "7+" : i}</span>
            </div>
          ))}
        </div>
        <div className="subtle mt-2.5 flex flex-wrap gap-2.5 text-[11.5px]">
          {used.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`dot seg-${s}`} />
              {SEG_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Roles con su mínimo marcado: verde si llega, ámbar si se queda cerca, rojo si muy lejos. */
export function RoleMeters({ roles }: { roles: RoleStatDTO[] }) {
  const low = roles.filter((r) => r.min > 0 && r.count < r.min).length;
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">Roles</span>
        {low > 0 && <span className="pill pill-warn">{low} bajo mínimo</span>}
      </div>
      <div className="px-3 pt-1 pb-2">
        {roles.map((r, i) => {
          const scale = r.min > 0 ? r.min / 0.8 : Math.max(r.count, 1) / 0.8;
          const width = Math.min(100, (r.count / scale) * 100);
          const cls =
            r.min === 0 ? "na" : r.count >= r.min ? "" : r.count >= r.min * 0.75 ? "low" : "crit";
          return (
            <div key={r.role} className={`role ${cls}`}>
              <span>{roleLabel(r.role)}</span>
              <div className="role-bar">
                <i style={{ width: `${width}%`, ["--d" as string]: `${i * 30}ms` }} />
                {r.min > 0 && <s style={{ left: "80%" }} />}
              </div>
              <span className="role-n">{r.min > 0 ? `${r.count} / ${r.min}` : r.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cifras generales del mazo. */
export function DeckFacts({ cards }: { cards: DeckCardDTO[] }) {
  const nonLand = cards.filter((c) => !isLand(c.card));
  const spells = nonLand.reduce((n, c) => n + c.quantity, 0);
  const lands = cards.filter((c) => isLand(c.card)).reduce((n, c) => n + c.quantity, 0);
  const avg = spells ? nonLand.reduce((n, c) => n + c.card.cmc * c.quantity, 0) / spells : 0;
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">Resumen</span>
      </div>
      <div className="px-3 pt-1 pb-2">
        <div className="kv">
          <span className="muted">Tierras</span>
          <b>{lands}</b>
        </div>
        <div className="kv">
          <span className="muted">Hechizos</span>
          <b>{spells}</b>
        </div>
        <div className="kv">
          <span className="muted">Coste medio (sin tierras)</span>
          <b>{avg.toFixed(2).replace(".", ",")}</b>
        </div>
      </div>
    </div>
  );
}

export const averageCmc = (cards: DeckCardDTO[]) => {
  const nonLand = cards.filter((c) => !isLand(c.card));
  const n = nonLand.reduce((a, c) => a + c.quantity, 0);
  return n ? nonLand.reduce((a, c) => a + c.card.cmc * c.quantity, 0) / n : 0;
};

// ---------- Lista del mazo ----------

export type ListView = "pilas" | "lista" | "texto";

function groupByRole(cards: DeckCardDTO[]) {
  return ROLES.map((role) => ({
    role,
    cards: cards
      .filter((c) => c.primaryRole === role)
      .sort((a, b) => a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name)),
  })).filter((g) => g.cards.length > 0);
}

/**
 * Las 99 por rol principal. Clic en una carta (pilas) o en el candado (lista) la bloquea: las
 * bloqueadas nunca se proponen para salir. `leaving` = las que salen con los cambios aceptados.
 */
export function DeckList({
  view,
  cards,
  locked,
  leaving,
  onToggleLock,
  text,
  onChangeQuantity,
  busy = false,
}: {
  view: ListView;
  cards: DeckCardDTO[];
  locked: ReadonlySet<string>;
  leaving: ReadonlySet<string>;
  onToggleLock: (oracleId: string) => void;
  text: string;
  /** Si el mazo se puede editar: quitar (−1) o, en básicas, añadir (+1) copias desde la tabla. */
  onChangeQuantity?: ((card: CardDTO, delta: number) => void) | undefined;
  busy?: boolean;
}) {
  const groups = groupByRole(cards);
  if (view === "texto") {
    return (
      <textarea
        className="textarea"
        readOnly
        aria-label="Lista en texto"
        style={{ minHeight: 320 }}
        value={text}
      />
    );
  }
  if (view === "lista") {
    return (
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Carta</th>
              <th>Coste</th>
              <th className="hide-sm">Rol</th>
              <th style={{ width: 40 }} />
              {onChangeQuantity && <th style={{ width: 70 }} />}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              g.cards.map((c) => {
                const isLocked = locked.has(c.card.oracleId);
                return (
                  <tr key={c.card.oracleId}>
                    <td className="mono subtle">{c.quantity}</td>
                    <td>
                      <CardHover card={c.card} className="inline-flex items-center gap-2">
                        {c.card.name}
                        {c.card.gameChanger && (
                          <span className="pill pill-warn" title="Game changer (brackets)">
                            GC
                          </span>
                        )}
                        {leaving.has(c.card.oracleId) && (
                          <span className="pill pill-out">sale</span>
                        )}
                      </CardHover>
                    </td>
                    <td>
                      <ManaCost cost={c.card.manaCost} />
                    </td>
                    <td className="muted hide-sm">{roleLabel(c.primaryRole)}</td>
                    <td>
                      {!c.isBasicLand && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{
                            width: 26,
                            height: 26,
                            color: isLocked ? "var(--color-warn)" : undefined,
                            opacity: isLocked ? 1 : 0.5,
                          }}
                          aria-pressed={isLocked}
                          aria-label={
                            isLocked ? `Desbloquear ${c.card.name}` : `Bloquear ${c.card.name}`
                          }
                          onClick={() => onToggleLock(c.card.oracleId)}
                        >
                          <IconLock size={13} />
                        </button>
                      )}
                    </td>
                    {onChangeQuantity && (
                      <td>
                        <span className="flex justify-end gap-0.5">
                          {c.isBasicLand && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              style={{ width: 26, height: 26 }}
                              disabled={busy}
                              aria-label={`Añadir otra ${c.card.name}`}
                              onClick={() => onChangeQuantity(c.card, 1)}
                            >
                              <IconPlus size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ width: 26, height: 26, color: "var(--color-out)" }}
                            disabled={busy}
                            aria-label={
                              c.quantity > 1 ? `Quitar una ${c.card.name}` : `Quitar ${c.card.name}`
                            }
                            title={c.quantity > 1 ? "Quitar una copia" : "Quitar del mazo"}
                            onClick={() => onChangeQuantity(c.card, -1)}
                          >
                            <IconMinus size={12} />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="stacks">
      {groups.map((g) => (
        <div key={g.role}>
          <div className="stack-h">
            {roleLabel(g.role)} <span>{g.cards.reduce((n, c) => n + c.quantity, 0)}</span>
          </div>
          <div className="stack">
            {g.cards.map((c) => {
              const isLocked = locked.has(c.card.oracleId);
              return (
                <button
                  key={c.card.oracleId}
                  type="button"
                  className="s-item"
                  title={
                    c.isBasicLand
                      ? c.card.name
                      : `${c.card.name} — clic para ${isLocked ? "desbloquear" : "bloquear"}`
                  }
                  aria-pressed={c.isBasicLand ? undefined : isLocked}
                  disabled={c.isBasicLand}
                  onClick={() => onToggleLock(c.card.oracleId)}
                >
                  {isLocked && (
                    <span className="lockmark" aria-label="Bloqueada">
                      <IconLock size={11} weight={2.6} />
                    </span>
                  )}
                  {leaving.has(c.card.oracleId) && <span className="outmark">sale</span>}
                  {c.card.gameChanger && !leaving.has(c.card.oracleId) && (
                    <span className="gcmark" title="Game changer (brackets)">
                      GC
                    </span>
                  )}
                  {c.quantity > 1 && !isLocked && <span className="qtymark">×{c.quantity}</span>}
                  <CardImage card={c.card} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
