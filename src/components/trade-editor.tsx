"use client";

import { useMemo, useState } from "react";
import { languageBadge, languageLabel } from "@/domain/cards/languages";
import { formatEuros } from "@/domain/suggestions/format";
import { tradeBalance, type TradeBalance } from "@/domain/trades/proposal";
import type { TradeCopyDTO } from "@/server/dto";
import { CardHover } from "./card-image";
import { IconMinus, IconPlus } from "./icons";
import { useLocale, useT } from "./i18n";

export type Side = "give" | "get";

/** Una línea de la propuesta en la UI: unas copias iguales y cuántas entran. */
export interface TradeLine {
  side: Side;
  copy: TradeCopyDTO;
  quantity: number;
}

/** Las líneas en el formato de la API. */
export const linesForApi = (lines: readonly TradeLine[]) =>
  lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      side: l.side,
      oracleId: l.copy.card.oracleId,
      scryfallId: l.copy.scryfallId,
      foil: l.copy.foil,
      language: l.copy.language,
      quantity: l.quantity,
    }));

export const toLines = (give: readonly TradeCopyDTO[], get: readonly TradeCopyDTO[]) => [
  ...give.map((copy) => ({ side: "give" as const, copy, quantity: copy.quantity })),
  ...get.map((copy) => ({ side: "get" as const, copy, quantity: copy.quantity })),
];

/** Balance con los precios de cada copia (la misma regla que el servidor). */
export function linesBalance(lines: readonly TradeLine[]): TradeBalance {
  const side = (s: Side) =>
    lines
      .filter((l) => l.side === s && l.quantity > 0)
      .map((l) => ({
        oracleId: l.copy.card.oracleId,
        scryfallId: l.copy.scryfallId,
        foil: l.copy.foil,
        language: l.copy.language,
        quantity: l.quantity,
        unitPrice: l.copy.unitPrice,
      }));
  return tradeBalance({ give: side("give"), get: side("get") });
}

/** Etiquetas de la copia: edición, foil e idioma (si no es inglés). */
function CopyTags({ copy }: { copy: TradeCopyDTO }) {
  const locale = useLocale();
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {copy.printing && (
        <span
          className="mono subtle text-xs"
          title={copy.printing.setName ?? copy.printing.setCode.toUpperCase()}
        >
          {copy.printing.setCode.toUpperCase()} {copy.printing.collectorNumber}
        </span>
      )}
      {copy.foil && <span className="pill pill-warn">foil</span>}
      {copy.language && copy.language !== "en" && (
        <span className="pill" title={languageLabel(copy.language, locale)}>
          {languageBadge(copy.language)}
        </span>
      )}
    </span>
  );
}

/** Barra de balance: lo que doy, lo que recibo y si está cuadrado. */
export function BalanceBar({
  balance,
  partner,
  editable,
}: {
  balance: TradeBalance;
  partner: string;
  /** Si se puede editar, dice qué hacer para cuadrarla; si no, solo cuánto se desvía. */
  editable: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const eur = (x: number) => formatEuros(x, locale);
  const off = Math.abs(balance.diff);
  return (
    <div className="panel flex flex-wrap items-center gap-x-5 gap-y-2 p-3.5 text-[13.5px]">
      <span>
        {t("Das", "You give")} <b className="mono">{eur(balance.giveValue)}</b>
      </span>
      <span>
        {t("Recibes", "You get")} <b className="mono">{eur(balance.getValue)}</b>
      </span>
      <span className="ml-auto">
        {balance.balanced ? (
          <span className="pill pill-in">
            {t("Cuadrado", "Balanced")}
            {off > 0 ? ` (±${eur(off)})` : ""}
          </span>
        ) : (
          <span
            className="pill pill-warn"
            title={`${t("Margen", "Margin")}: ${eur(balance.tolerance)}`}
          >
            {balance.diff > 0
              ? t(
                  `Sales ganando ${eur(off)}${editable ? `: añade algo para @${partner}` : ""}`,
                  `You come out ${eur(off)} ahead${editable ? `: add something for @${partner}` : ""}`,
                )
              : t(
                  `Das ${eur(off)} de más${editable ? `: pide algo más a @${partner}` : ""}`,
                  `You give ${eur(off)} too much${editable ? `: ask @${partner} for something else` : ""}`,
                )}
          </span>
        )}
      </span>
    </div>
  );
}

/** Una columna: lo que doy o lo que recibo, con ± por copia y para añadir más. */
function Column({
  title,
  lines,
  available,
  editable,
  unavailable,
  onChange,
}: {
  title: string;
  lines: TradeLine[];
  /** Copias que se pueden añadir (null = no editable). */
  available: TradeCopyDTO[] | null;
  editable: boolean;
  unavailable: ReadonlySet<string>;
  onChange: (copy: TradeCopyDTO, quantity: number) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const eur = (x: number) => formatEuros(x, locale);
  const [filter, setFilter] = useState("");
  const value = lines.reduce((n, l) => n + (l.copy.unitPrice ?? 0) * l.quantity, 0);
  const max = (copy: TradeCopyDTO) =>
    available?.find((a) => a.key === copy.key)?.quantity ?? copy.quantity;
  const used = new Map(lines.map((l) => [l.copy.key, l.quantity]));
  const q = filter.trim().toLowerCase();
  const addable = (available ?? [])
    .filter((a) => (used.get(a.key) ?? 0) < a.quantity)
    .filter((a) => !q || a.card.name.toLowerCase().includes(q));
  return (
    <section className="panel flex min-w-0 flex-col">
      <div className="panel-h">
        <span className="h2">{title}</span>
        <span className="mono subtle text-xs">{eur(value)}</span>
      </div>
      {lines.length === 0 ? (
        <p className="subtle p-3.5 text-[13px]">{t("Ninguna carta.", "No cards.")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {lines.map((l) => (
            <li
              key={l.copy.key}
              className="flex items-center gap-2 border-b border-line px-3.5 py-1.5 text-[13.5px] last:border-b-0"
            >
              {editable ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    style={{ width: 24, height: 24 }}
                    aria-label={t(
                      `Una copia menos de ${l.copy.card.name}`,
                      `One fewer ${l.copy.card.name}`,
                    )}
                    onClick={() => onChange(l.copy, l.quantity - 1)}
                  >
                    <IconMinus size={12} />
                  </button>
                  <span className="mono" style={{ minWidth: 16, textAlign: "center" }}>
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    style={{ width: 24, height: 24 }}
                    disabled={l.quantity >= max(l.copy)}
                    aria-label={t(
                      `Una copia más de ${l.copy.card.name}`,
                      `One more ${l.copy.card.name}`,
                    )}
                    onClick={() => onChange(l.copy, l.quantity + 1)}
                  >
                    <IconPlus size={12} />
                  </button>
                </span>
              ) : (
                <span className="mono subtle" style={{ width: 24 }}>
                  {l.quantity}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <CardHover card={l.copy.card} className="truncate">
                  {l.copy.card.name}
                </CardHover>
                <CopyTags copy={l.copy} />
              </span>
              {unavailable.has(l.copy.card.oracleId) && (
                <span
                  className="pill pill-out"
                  title={t("Ya no está en su lista para cambiar", "No longer on their trade list")}
                >
                  {t("no disponible", "unavailable")}
                </span>
              )}
              <span className="mono subtle whitespace-nowrap">
                {l.copy.unitPrice !== null ? eur(l.copy.unitPrice * l.quantity) : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editable && available && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-3.5 py-2 text-[13px]">
            {t("Añadir más", "Add more")} ({addable.length})
          </summary>
          <div className="flex flex-col gap-2 px-3.5 pb-3">
            <input
              className="input"
              placeholder={t("Filtrar por nombre…", "Filter by name…")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ul
              className="m-0 flex list-none flex-col p-0"
              style={{ maxHeight: 260, overflow: "auto" }}
            >
              {addable.slice(0, 100).map((a) => (
                <li key={a.key} className="flex items-center gap-2 py-1 text-[13px]">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <CardHover card={a.card} className="truncate">
                      {a.card.name}
                    </CardHover>
                    <CopyTags copy={a} />
                  </span>
                  <span className="mono subtle whitespace-nowrap text-xs">
                    {a.unitPrice !== null ? eur(a.unitPrice) : "—"} · {a.quantity}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    style={{ width: 24, height: 24 }}
                    aria-label={t(`Añadir ${a.card.name}`, `Add ${a.card.name}`)}
                    onClick={() => onChange(a, (used.get(a.key) ?? 0) + 1)}
                  >
                    <IconPlus size={12} />
                  </button>
                </li>
              ))}
              {addable.length === 0 && (
                <li className="subtle text-[13px]">
                  {t("Nada más que añadir.", "Nothing else to add.")}
                </li>
              )}
            </ul>
          </div>
        </details>
      )}
    </section>
  );
}

/**
 * Las dos columnas de un intercambio (lo que doy y lo que recibo) con el balance arriba. Si es
 * editable, ± por copia (sin pasar de las que hay para cambiar) y "Añadir más".
 */
export function TradeEditor({
  partner,
  lines,
  onChange,
  myCopies,
  theirCopies,
  unavailable = [],
}: {
  partner: string;
  lines: TradeLine[];
  /** Sin esto, solo lectura. */
  onChange?: ((lines: TradeLine[]) => void) | undefined;
  myCopies?: TradeCopyDTO[] | null | undefined;
  theirCopies?: TradeCopyDTO[] | null | undefined;
  unavailable?: readonly string[];
}) {
  const t = useT();
  const balance = useMemo(() => linesBalance(lines), [lines]);
  const missing = useMemo(() => new Set(unavailable), [unavailable]);
  const change = (side: Side) => (copy: TradeCopyDTO, quantity: number) => {
    if (!onChange) return;
    const rest = lines.filter((l) => !(l.side === side && l.copy.key === copy.key));
    const idx = lines.findIndex((l) => l.side === side && l.copy.key === copy.key);
    if (quantity <= 0) return onChange(rest);
    const line = { side, copy, quantity };
    onChange(idx >= 0 ? lines.map((l, i) => (i === idx ? line : l)) : [...lines, line]);
  };
  return (
    <div className="flex flex-col gap-3">
      <BalanceBar balance={balance} partner={partner} editable={Boolean(onChange)} />
      <div
        className="grid-1-sm grid items-start gap-4"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <Column
          title={t(`Das a @${partner}`, `You give @${partner}`)}
          lines={lines.filter((l) => l.side === "give")}
          available={myCopies ?? null}
          editable={Boolean(onChange)}
          unavailable={missing}
          onChange={change("give")}
        />
        <Column
          title={t(`Recibes de @${partner}`, `You get from @${partner}`)}
          lines={lines.filter((l) => l.side === "get")}
          available={theirCopies ?? null}
          editable={Boolean(onChange)}
          unavailable={missing}
          onChange={change("get")}
        />
      </div>
    </div>
  );
}
