"use client";

import { useState } from "react";
import type { ComboBracketTag } from "@/domain/combos/types";
import { formatEuros } from "@/domain/suggestions/format";
import type { ComboCardDTO, ComboDTO, DeckCombosDTO, OneAwayComboDTO } from "@/server/dto";
import { CardHover, CardImage } from "./card-image";
import { Banner, EmptyState, Loading, fmt } from "./ui";
import { useIntlLocale, useLocale, useT, type T } from "./i18n";

/** Etiquetas de bracket de Commander Spellbook, en el idioma de la página. */
const tags = (t: T): Record<ComboBracketTag, { label: string; tone: string; hint: string }> => ({
  R: {
    label: t("Temprano", "Early"),
    tone: "pill-out",
    hint: t(
      "Combo temprano de dos cartas: bracket 4 o más",
      "Early two-card combo: bracket 4 or higher",
    ),
  },
  S: {
    label: t("Fuerte", "Strong"),
    tone: "pill-warn",
    hint: t("Combo de dos cartas para más tarde: bracket 3", "Late-game two-card combo: bracket 3"),
  },
  P: {
    label: t("Potente", "Powerful"),
    tone: "pill-warn",
    hint: t("Combo potente: bracket 3", "Powerful combo: bracket 3"),
  },
  O: { label: t("Curioso", "Oddball"), tone: "", hint: t("Combo poco habitual", "Unusual combo") },
  C: {
    label: t("Básico", "Casual"),
    tone: "",
    hint: t("Combo que encaja en cualquier bracket", "Fits any bracket"),
  },
  E: { label: t("Exhibición", "Exhibition"), tone: "", hint: t("Combo casual", "Casual combo") },
  B: {
    label: t("Prohibido", "Banned"),
    tone: "pill-out",
    hint: t("Usa una carta prohibida", "Uses a banned card"),
  },
});

const statuses = (t: T): Record<OneAwayComboDTO["status"], { label: string; tone: string }> => ({
  owned: { label: t("La tienes", "You have it"), tone: "pill-in" },
  in_other_decks: { label: t("En otro mazo", "In another deck"), tone: "pill-warn" },
  buy: { label: t("Hay que comprarla", "Needs buying"), tone: "" },
});

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
  const t = useT();
  const tag = combo.bracketTag ? tags(t)[combo.bracketTag] : null;
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
              <span className="muted">{t("Consigue: ", "Produces: ")}</span>
              {combo.produces.join(" · ")}
            </span>
          )}
          {combo.requires.length > 0 && (
            <span>
              <span className="muted">{t("Necesita además: ", "Also requires: ")}</span>
              {combo.requires.join(" · ")}
            </span>
          )}
          {combo.manaValueNeeded > 0 && (
            <span className="subtle text-xs">
              {t("Maná para hacerlo:", "Mana needed:")} {combo.manaValueNeeded}
            </span>
          )}
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
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const STATUS = statuses(t);
  const [filter, setFilter] = useState<Filter>("all");

  if (error) return <Banner tone="out">{error}</Banner>;
  if (!data) return <Loading>{t("Buscando combos…", "Looking for combos…")}</Loading>;

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
            {t("En tu mazo", "In your deck")}{" "}
            <span className="mono subtle" style={{ fontWeight: 400 }}>
              {data.included.length}
            </span>
          </span>
        </div>
        {data.included.length === 0 ? (
          <EmptyState title={t("No tiene ningún combo completo", "No complete combos")}>
            {t("Abajo tienes los que están a una carta.", "Below are the ones one card away.")}
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
            <span className="h2">
              {t("Las cartas que más combos te abren", "The cards that unlock the most combos")}
            </span>
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
                    <td className="mono whitespace-nowrap">
                      {k.combos} {t("combos", "combos")}
                    </td>
                    <td className="r whitespace-nowrap">
                      <span className={`pill ${STATUS[k.status].tone}`}>
                        {STATUS[k.status].label}
                        {k.status === "buy" &&
                          k.price !== null &&
                          ` · ${formatEuros(k.price, locale)}`}
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
            {t("A una carta", "One card away")}{" "}
            <span className="mono subtle" style={{ fontWeight: 400 }}>
              {fmt(data.oneAwayTotal, locale)}
            </span>
          </span>
          <div className="chips" role="radiogroup" aria-label={t("Filtrar", "Filter")}>
            {(
              [
                ["all", t("Todos", "All")],
                [
                  "owned",
                  t(`Con tu colección (${owned.length})`, `With your collection (${owned.length})`),
                ],
                ["buy", t("Comprando", "Buying")],
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
              ? t(
                  "Ninguno se completa con cartas de tu colección.",
                  "None can be completed with cards from your collection.",
                )
              : t("No hay combos a una carta.", "No combos one card away.")}
          </p>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {shown.map((o) => (
              <ComboRow
                key={o.combo.id}
                combo={o.combo}
                extra={
                  <>
                    <span className="muted">· {t("falta", "missing")}</span>
                    <b>{o.missing.name}</b>
                    <span className={`pill ${STATUS[o.status].tone}`}>
                      {STATUS[o.status].label}
                      {o.status === "buy" &&
                        o.price !== null &&
                        ` · ${formatEuros(o.price, locale)}`}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        )}
        {data.oneAwayTotal > data.oneAway.length && (
          <p className="subtle px-3.5 pb-3 text-xs">
            {t(
              `Se muestran los ${data.oneAway.length} más interesantes de ${fmt(data.oneAwayTotal, locale)}.`,
              `Showing the ${data.oneAway.length} most interesting of ${fmt(data.oneAwayTotal, locale)}.`,
            )}
          </p>
        )}
      </section>

      <p className="subtle text-xs">
        {t(
          `Combos actualizados el ${new Date(data.fetchedAt).toLocaleDateString(intl)}. Las etiquetas (temprano, fuerte…) cuentan para el bracket estimado.`,
          `Combos updated on ${new Date(data.fetchedAt).toLocaleDateString(intl)}. The tags (early, strong…) count towards the estimated bracket.`,
        )}
      </p>
    </div>
  );
}
