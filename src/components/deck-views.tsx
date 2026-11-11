"use client";

import { useState } from "react";
import { curveByColor, deckSummary, type CurveSeg } from "@/domain/deck/color-curve";
import { ROLES, type Role } from "@/domain/roles/types";
import { roleLabel as localizedRole } from "@/domain/i18n/labels";
import type { Locale } from "@/domain/i18n/locale";
import { useIntlLocale, useLocale, useT, type T } from "./i18n";
import type { CardDTO, DeckCardDTO, RoleStatDTO, ScoredCardDTO, SwapDTO } from "@/server/dto";
import { CardHover, CardImage } from "./card-image";
import { IconArrowRight, IconChevron, IconLock, IconMinus, IconPlus, IconX } from "./icons";
import { ManaCost } from "./mana";

export type Decision = "accepted" | "rejected";

const pct = (x: number, intl: string) => `${Math.round(x * 100)}${intl === "en-GB" ? "" : " "}%`;
const signedPct = (x: number, intl: string) => `${x >= 0 ? "+" : "−"}${pct(Math.abs(x), intl)}`;
/** Mejora de la puntuación del motor, con un decimal ("4,4" / "4.4"). */
export const points = (score: number, intl = "es-ES") =>
  score.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** De dónde salen los roles (la etiqueta pequeña junto al rol en la tabla). */
const roleSourcePill = (s: DeckCardDTO["roleSource"], t: T) =>
  ({
    auto: "",
    list: t("lista", "list"),
    mine: t("tuyo", "yours"),
    deck: t("este mazo", "this deck"),
  })[s];
const roleSourceTitle = (s: DeckCardDTO["roleSource"], t: T) =>
  ({
    auto: "",
    list: t("De la lista", "From the list"),
    mine: t("Corregido por ti (en todos tus mazos)", "Corrected by you (in all your decks)"),
    deck: t("Corregido por ti solo en este mazo", "Corrected by you in this deck only"),
  })[s];

/** Las etiquetas de rol van en minúscula (se usan dentro de frases); en la interfaz, con mayúscula. */
export const roleLabel = (role: Role, locale: Locale = "es") => {
  const l = localizedRole(role, locale);
  return l.charAt(0).toUpperCase() + l.slice(1);
};

// ---------- Cambios (diff) ----------

function SwapRow({ sign, scored }: { sign: "−" | "+"; scored: ScoredCardDTO }) {
  const t = useT();
  const intl = useIntlLocale();
  const { card } = scored;
  return (
    <CardHover card={card} as="div" className={`diff-row ${sign === "−" ? "minus" : "plus"}`}>
      <span className="sign" aria-label={sign === "−" ? t("Sale", "Out") : t("Entra", "In")}>
        {sign}
      </span>
      <span className="nm" style={sign === "+" ? { fontWeight: 500 } : undefined}>
        1 {card.name}
      </span>
      <span className="flex items-center gap-3">
        <ManaCost cost={card.manaCost} />
        {scored.price !== undefined && (
          <span className="mono subtle hide-sm w-14 text-right text-xs">
            {scored.price.toLocaleString(intl, { style: "currency", currency: "EUR" })}
          </span>
        )}
      </span>
    </CardHover>
  );
}

function ownedLabel(s: ScoredCardDTO, t: T): string | null {
  if (s.available === undefined) return null;
  return s.available === 1
    ? t("Tienes 1 libre", "You have 1 free")
    : t(`Tienes ${s.available} libres`, `You have ${s.available} free`);
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
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const [open, setOpen] = useState(false);
  const role = roleLabel(swap.in.primaryRole, locale);
  const owned = ownedLabel(swap.in, t);
  const cls =
    decision === "accepted" ? "is-accepted" : decision === "rejected" ? "is-discarded" : "";
  return (
    <div className={`diff-item ${cls}`}>
      <div className="diff-hunk">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          style={{ width: 24, height: 24 }}
          aria-label={
            open ? t("Ocultar las cartas", "Hide the cards") : t("Ver las cartas", "Show the cards")
          }
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
        <span
          className="score ml-auto"
          title={t(
            "Mejora estimada: cuánto más se juega la que entra que la que sale, más el rol",
            "Estimated improvement: how much more the incoming card is played than the outgoing one, plus the role",
          )}
        >
          +{points(swap.score, intl)}
        </span>
        {decision ? (
          <span className="flex items-center gap-2">
            <span className={decision === "accepted" ? "pill pill-in" : "pill subtle"}>
              {decision === "accepted" ? t("Aceptado", "Accepted") : t("Descartado", "Dismissed")}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDecide(undefined)}
            >
              {t("Deshacer", "Undo")}
            </button>
          </span>
        ) : (
          <span className="flex gap-2">
            <button
              type="button"
              className="btn btn-in btn-sm"
              onClick={() => onDecide("accepted")}
            >
              {t("Aceptar", "Accept")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t(`Descartar ${swap.in.card.name}`, `Dismiss ${swap.in.card.name}`)}
              onClick={() => onDecide("rejected")}
            >
              <IconX size={13} />
            </button>
          </span>
        )}
      </div>
      <div className="diff-body">
        {/* Las dos cartas sobre la mesa: al aceptar, la que entra ocupa el sitio de la que sale. */}
        <div className="diff-cards" aria-hidden="true">
          <CardImage card={swap.out.card} className="dc-out" sizes="54px" />
          <CardImage card={swap.in.card} className="dc-in" sizes="54px" />
        </div>
        <div className="min-w-0">
          <SwapRow sign="−" scored={swap.out} />
          <SwapRow sign="+" scored={swap.in} />
          <div className="diff-meta">
            {swap.in.synergy !== null && (
              <span>
                {t("Sinergia", "Synergy")}{" "}
                <b className="mono">{signedPct(swap.in.synergy, intl)}</b>
              </span>
            )}
            {swap.in.inclusion !== null && (
              <span>
                {t("En el", "In")} <b className="mono">{pct(swap.in.inclusion, intl)}</b>{" "}
                {t(`de los mazos de ${commanderName}`, `of ${commanderName} decks`)}
              </span>
            )}
            <span>{swap.reason}</span>
          </div>
        </div>
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

type Seg = CurveSeg;
const segLabel = (s: Seg, t: T) =>
  ({
    w: t("Blanco", "White"),
    u: t("Azul", "Blue"),
    b: t("Negro", "Black"),
    r: t("Rojo", "Red"),
    g: t("Verde", "Green"),
    m: t("Multicolor", "Multicolor"),
    c: t("Incoloro", "Colorless"),
  })[s];
/** Curva de maná de las cartas que no son tierra, apilada por color (identidad de cada carta). */
export function ManaCurve({ cards }: { cards: { card: CardDTO; quantity: number }[] }) {
  const t = useT();
  const { columns, max, used, spells } = curveByColor(cards);
  const totals = columns.map((c) => c.total);
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">{t("Curva de maná", "Mana curve")}</span>
        <span className="mono subtle text-xs">
          {spells} {t("hechizos", "spells")}
        </span>
      </div>
      <div className="p-3">
        <div
          className="curve"
          role="img"
          aria-label={`${t("Curva de maná", "Mana curve")}: ${totals.map((n, i) => `${i === 7 ? "7+" : i}: ${n}`).join(", ")}`}
        >
          {columns.map((col, i) => (
            <div key={i} className="curve-col">
              <span className="curve-n">{totals[i] || ""}</span>
              <div
                className="curve-stack"
                style={{
                  height: `${((totals[i] ?? 0) / max) * 78}%`,
                  ["--d" as string]: `${i * 30}ms`,
                }}
              >
                {col.segs.map((s) => (
                  <div
                    key={s.seg}
                    className={`seg-${s.seg}`}
                    style={{ height: `${(s.count / (col.total || 1)) * 100}%` }}
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
              {segLabel(s, t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Roles con su mínimo marcado: verde si llega, ámbar si se queda cerca, rojo si muy lejos. */
export function RoleMeters({ roles }: { roles: RoleStatDTO[] }) {
  const t = useT();
  const locale = useLocale();
  const low = roles.filter((r) => r.min > 0 && r.count < r.min).length;
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">{t("Roles", "Roles")}</span>
        {low > 0 && (
          <span className="pill pill-warn">
            {low} {t("bajo mínimo", "below minimum")}
          </span>
        )}
      </div>
      <div className="px-3 pt-1 pb-2">
        {roles.map((r, i) => {
          const scale = r.min > 0 ? r.min / 0.8 : Math.max(r.count, 1) / 0.8;
          const width = Math.min(100, (r.count / scale) * 100);
          const cls =
            r.min === 0 ? "na" : r.count >= r.min ? "" : r.count >= r.min * 0.75 ? "low" : "crit";
          return (
            <div key={r.role} className={`role ${cls}`}>
              <span>{roleLabel(r.role, locale)}</span>
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
  const t = useT();
  const intl = useIntlLocale();
  const { lands, spells, averageCmc: avg } = deckSummary(cards);
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">{t("Resumen", "Summary")}</span>
      </div>
      <div className="px-3 pt-1 pb-2">
        <div className="kv">
          <span className="muted">{t("Tierras", "Lands")}</span>
          <b>{lands}</b>
        </div>
        <div className="kv">
          <span className="muted">{t("Hechizos", "Spells")}</span>
          <b>{spells}</b>
        </div>
        <div className="kv">
          <span className="muted">
            {t("Coste medio (sin tierras)", "Avg. mana value (no lands)")}
          </span>
          <b>{avg.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
        </div>
      </div>
    </div>
  );
}

export const averageCmc = (cards: DeckCardDTO[]) => deckSummary(cards).averageCmc;

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
  onEditRoles,
  onEditPrinting,
  inOtherDecks,
  notes,
  onEditNote,
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
  /** Corregir los roles y etiquetas de una carta (desde la columna "Rol" de la tabla). */
  onEditRoles?: ((card: DeckCardDTO) => void) | undefined;
  /** Elegir la impresión de una carta (columna "Edición"). */
  onEditPrinting?: ((card: CardDTO) => void) | undefined;
  /** Mis notas por carta (oracleId → texto) y cómo editarlas (solo en un mazo mío guardado). */
  notes?: Readonly<Record<string, string>> | undefined;
  onEditNote?: ((card: CardDTO) => void) | undefined;
  /** Cartas que tengo pero están en otros mazos (o prestadas): oracleId → dónde. */
  inOtherDecks?: ReadonlyMap<string, readonly string[]> | undefined;
  busy?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const groups = groupByRole(cards);
  if (view === "texto") {
    return (
      <textarea
        className="textarea"
        readOnly
        aria-label={t("Lista en texto", "List as text")}
        style={{ minHeight: 320 }}
        value={text}
      />
    );
  }
  if (view === "lista") {
    return (
      <div className="panel overflow-x-auto">
        <table className="table rtable">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>{t("Carta", "Card")}</th>
              <th>{t("Coste", "Cost")}</th>
              <th>{t("Rol", "Role")}</th>
              <th>{t("Edición", "Printing")}</th>
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
                    <td className="mono subtle rt-qty">{c.quantity}</td>
                    <td className="rt-main">
                      <CardHover card={c.card} className="inline-flex items-center gap-2">
                        {c.card.name}
                        {c.card.gameChanger && (
                          <span className="pill pill-warn" title="Game changer (brackets)">
                            GC
                          </span>
                        )}
                        {leaving.has(c.card.oracleId) && (
                          <span className="pill pill-out">{t("sale", "out")}</span>
                        )}
                        {inOtherDecks?.has(c.card.oracleId) && (
                          <span
                            className="pill pill-inuse"
                            title={`${t("La tienes en", "You have it in")}: ${inOtherDecks.get(c.card.oracleId)?.join(", ")}`}
                          >
                            {t("en", "in")} {inOtherDecks.get(c.card.oracleId)?.join(", ")}
                          </span>
                        )}
                      </CardHover>
                      {c.tags.length > 0 && (
                        <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                          {c.tags.map((tag) => (
                            <span key={tag} className="pill subtle">
                              #{tag}
                            </span>
                          ))}
                        </span>
                      )}
                      {onEditNote &&
                        (notes?.[c.card.oracleId] ? (
                          <button
                            type="button"
                            className="cardnote"
                            title={t("Editar la nota", "Edit the note")}
                            onClick={() => onEditNote(c.card)}
                          >
                            {notes[c.card.oracleId]}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="cardnote-add"
                            aria-label={t(
                              `Añadir una nota a ${c.card.name}`,
                              `Add a note to ${c.card.name}`,
                            )}
                            onClick={() => onEditNote(c.card)}
                          >
                            {t("+ nota", "+ note")}
                          </button>
                        ))}
                    </td>
                    <td>
                      <ManaCost cost={c.card.manaCost} />
                    </td>
                    <td className="muted whitespace-nowrap">
                      {onEditRoles && !c.isBasicLand ? (
                        <button
                          type="button"
                          className="linkbtn"
                          title={
                            c.roleSource === "deck"
                              ? t(
                                  "Roles corregidos por ti solo en este mazo. Clic para cambiarlos",
                                  "Roles corrected by you in this deck only. Click to change them",
                                )
                              : c.roleSource === "mine"
                                ? t(
                                    "Roles corregidos por ti. Clic para cambiarlos",
                                    "Roles corrected by you. Click to change them",
                                  )
                                : c.roleSource === "list"
                                  ? t(
                                      "Roles de las etiquetas de la lista. Clic para cambiarlos",
                                      "Roles from the list's tags. Click to change them",
                                    )
                                  : t(
                                      "Roles automáticos. Clic para corregirlos",
                                      "Automatic roles. Click to correct them",
                                    )
                          }
                          onClick={() => onEditRoles(c)}
                        >
                          {roleLabel(c.primaryRole, locale)}
                          {c.roles.length > 1 && (
                            <span className="subtle"> +{c.roles.length - 1}</span>
                          )}
                        </button>
                      ) : (
                        roleLabel(c.primaryRole, locale)
                      )}
                      {c.roleSource !== "auto" && (
                        <span
                          className="pill subtle ml-1.5"
                          title={roleSourceTitle(c.roleSource, t)}
                        >
                          {roleSourcePill(c.roleSource, t)}
                        </span>
                      )}
                    </td>
                    <td className="mono subtle whitespace-nowrap text-xs">
                      {onEditPrinting ? (
                        <button
                          type="button"
                          className="linkbtn"
                          title={
                            c.card.printing
                              ? `${c.card.printing.setName ?? ""} #${c.card.printing.collectorNumber}. ${t("Clic para cambiarla", "Click to change it")}`
                              : t(
                                  "Por defecto. Clic para elegir edición",
                                  "Default. Click to choose a printing",
                                )
                          }
                          onClick={() => onEditPrinting(c.card)}
                        >
                          {c.card.printing
                            ? c.card.printing.setCode.toUpperCase()
                            : t("elegir", "choose")}
                        </button>
                      ) : (
                        (c.card.printing?.setCode.toUpperCase() ?? "—")
                      )}
                    </td>
                    <td className="rt-end">
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
                            isLocked
                              ? t(`Desbloquear ${c.card.name}`, `Unlock ${c.card.name}`)
                              : t(`Bloquear ${c.card.name}`, `Lock ${c.card.name}`)
                          }
                          onClick={() => onToggleLock(c.card.oracleId)}
                        >
                          <IconLock size={13} />
                        </button>
                      )}
                    </td>
                    {onChangeQuantity && (
                      <td className="rt-end">
                        <span className="flex justify-end gap-0.5">
                          {c.maxCopies !== 1 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              style={{ width: 26, height: 26 }}
                              disabled={busy || (c.maxCopies !== null && c.quantity >= c.maxCopies)}
                              aria-label={t(
                                `Añadir otra ${c.card.name}`,
                                `Add another ${c.card.name}`,
                              )}
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
                              c.quantity > 1
                                ? t(`Quitar una ${c.card.name}`, `Remove one ${c.card.name}`)
                                : t(`Quitar ${c.card.name}`, `Remove ${c.card.name}`)
                            }
                            title={
                              c.quantity > 1
                                ? t("Quitar una copia", "Remove a copy")
                                : t("Quitar del mazo", "Remove from deck")
                            }
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
            {roleLabel(g.role, locale)} <span>{g.cards.reduce((n, c) => n + c.quantity, 0)}</span>
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
                      : `${c.card.name} — ${isLocked ? t("clic para desbloquear", "click to unlock") : t("clic para bloquear", "click to lock")}`
                  }
                  aria-pressed={c.isBasicLand ? undefined : isLocked}
                  disabled={c.isBasicLand}
                  onClick={() => onToggleLock(c.card.oracleId)}
                >
                  {isLocked && (
                    <span className="lockmark" aria-label={t("Bloqueada", "Locked")}>
                      <IconLock size={11} weight={2.6} />
                    </span>
                  )}
                  {leaving.has(c.card.oracleId) && (
                    <span className="outmark">{t("sale", "out")}</span>
                  )}
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
