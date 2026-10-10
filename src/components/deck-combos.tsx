"use client";

import { useState } from "react";
import type { ComboBracketTag } from "@/domain/combos/types";
import { formatEuros } from "@/domain/suggestions/format";
import type { ComboCardDTO, ComboDTO, DeckCombosDTO, OneAwayComboDTO } from "@/server/dto";
import { CardHover, CardImage } from "./card-image";
import { Banner, EmptyState, Loading, fmt } from "./ui";

/** Etiquetas de bracket de Commander Spellbook, en español. */
const TAG: Record<ComboBracketTag, { label: string; tone: string; hint: string }> = {
  R: { label: "Temprano", tone: "pill-out", hint: "Combo temprano de dos cartas: bracket 4 o más" },
  S: { label: "Fuerte", tone: "pill-warn", hint: "Combo de dos cartas para más tarde: bracket 3" },
  P: { label: "Potente", tone: "pill-warn", hint: "Combo potente: bracket 3" },
  O: { label: "Curioso", tone: "", hint: "Combo poco habitual" },
  C: { label: "Básico", tone: "", hint: "Combo que encaja en cualquier bracket" },
  E: { label: "Exhibición", tone: "", hint: "Combo casual" },
  B: { label: "Prohibido", tone: "pill-out", hint: "Usa una carta prohibida" },
};

const STATUS: Record<OneAwayComboDTO["status"], { label: string; tone: string }> = {
  owned: { label: "La tienes", tone: "pill-in" },
  in_other_decks: { label: "En otro mazo", tone: "pill-warn" },
  buy: { label: "Hay que comprarla", tone: "" },
};

type Filter = "all" | "owned" | "buy";

function ComboCards({ cards, highlight }: { cards: ComboCardDTO[]; highlight?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((c) => (
        <div
          key={c.name}
          className="flex flex-col gap-1"
          style={{
            width: 78,
            opacity: highlight && c.name !== highlight ? 0.75 : 1,
          }}
        >
          {c.card ? (
            <CardHover card={c.card} as="div">
              <CardImage
                card={c.card}
                style={c.name === highlight ? { outline: "2px solid var(--color-accent)" } : {}}
              />
            </CardHover>
          ) : (
            <div className="cardimg cardimg-missing" />
          )}
          <span className="subtle truncate text-[11px]" title={c.name}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function ComboRow({ combo, extra }: { combo: ComboDTO; extra?: React.ReactNode }) {
  const tag = combo.bracketTag ? TAG[combo.bracketTag] : null;
  return (
    <li className="flex flex-col gap-2 border-b border-line px-3.5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
        <b>{combo.cards.map((c) => c.name).join(" + ")}</b>
        {tag && (
          <span className={`pill ${tag.tone}`} title={tag.hint}>
            {tag.label}
          </span>
        )}
        {extra}
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <ComboCards cards={combo.cards} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]" style={{ minWidth: 200 }}>
          {combo.produces.length > 0 && (
            <span>
              <span className="muted">Consigue: </span>
              {combo.produces.join(" · ")}
            </span>
          )}
          {combo.requires.length > 0 && (
            <span>
              <span className="muted">Necesita además: </span>
              {combo.requires.join(" · ")}
            </span>
          )}
          {combo.manaValueNeeded > 0 && (
            <span className="subtle text-xs">Maná para hacerlo: {combo.manaValueNeeded}</span>
          )}
          <a className="text-xs" href={combo.url} target="_blank" rel="noopener noreferrer">
            Cómo se hace, en Commander Spellbook ↗
          </a>
        </div>
      </div>
    </li>
  );
}

/**
 * Pestaña "Combos": los que el mazo ya tiene y los que están a una carta, primero los que
 * completas con tu colección. Datos de Commander Spellbook.
 */
export function CombosPanel({
  data,
  error,
  loading,
}: {
  data: DeckCombosDTO | null;
  error: string | null;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  if (error) return <Banner tone="out">{error}</Banner>;
  if (!data) return <Loading>Buscando combos en Commander Spellbook…</Loading>;

  const owned = data.oneAway.filter((o) => o.status !== "buy");
  const shown =
    filter === "owned"
      ? owned
      : filter === "buy"
        ? data.oneAway.filter((o) => o.status === "buy")
        : data.oneAway;

  return (
    <div className="flex flex-col gap-4" style={{ opacity: loading ? 0.5 : 1 }}>
      {data.warning && <Banner tone={data.stale ? "warn" : "info"}>{data.warning}</Banner>}

      <section className="panel">
        <div className="panel-h">
          <span className="h2">
            En tu mazo{" "}
            <span className="mono subtle" style={{ fontWeight: 400 }}>
              {data.included.length}
            </span>
          </span>
        </div>
        {data.included.length === 0 ? (
          <EmptyState title="No tiene ningún combo completo">
            Abajo tienes los que están a una carta.
          </EmptyState>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {data.included.map((c) => (
              <ComboRow key={c.id} combo={c} />
            ))}
          </ul>
        )}
      </section>

      {data.keyCards.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <span className="h2">Las cartas que más combos te abren</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                {data.keyCards.map((k) => (
                  <tr key={k.card.name}>
                    <td>
                      {k.card.card ? (
                        <CardHover card={k.card.card}>{k.card.name}</CardHover>
                      ) : (
                        k.card.name
                      )}
                    </td>
                    <td className="mono whitespace-nowrap">{k.combos} combos</td>
                    <td className="r whitespace-nowrap">
                      <span className={`pill ${STATUS[k.status].tone}`}>
                        {STATUS[k.status].label}
                        {k.status === "buy" && k.price !== null && ` · ${formatEuros(k.price)}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-h stack-sm py-2">
          <span className="h2">
            A una carta{" "}
            <span className="mono subtle" style={{ fontWeight: 400 }}>
              {fmt(data.oneAwayTotal)}
            </span>
          </span>
          <div className="chips" role="radiogroup" aria-label="Filtrar">
            {(
              [
                ["all", "Todos"],
                ["owned", `Con tu colección (${owned.length})`],
                ["buy", "Comprando"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                className={`chipbtn ${filter === f ? "is-on" : ""}`}
                onClick={() => setFilter(f)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="subtle p-3.5 text-[13px]">
            {filter === "owned"
              ? "Ninguno se completa con cartas de tu colección."
              : "No hay combos a una carta."}
          </p>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {shown.map((o) => (
              <ComboRow
                key={o.combo.id}
                combo={o.combo}
                extra={
                  <>
                    <span className="muted">· falta</span>
                    <b>{o.missing.name}</b>
                    <span className={`pill ${STATUS[o.status].tone}`}>
                      {STATUS[o.status].label}
                      {o.status === "buy" && o.price !== null && ` · ${formatEuros(o.price)}`}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        )}
        {data.oneAwayTotal > data.oneAway.length && (
          <p className="subtle px-3.5 pb-3 text-xs">
            Se muestran los {data.oneAway.length} más interesantes de {fmt(data.oneAwayTotal)}.
          </p>
        )}
      </section>

      <p className="subtle text-xs">
        Datos de{" "}
        <a href="https://commanderspellbook.com" target="_blank" rel="noopener noreferrer">
          Commander Spellbook
        </a>{" "}
        ({new Date(data.fetchedAt).toLocaleDateString("es")}). Las etiquetas (temprano, fuerte…) son
        las suyas y cuentan para el bracket estimado.
      </p>
    </div>
  );
}
