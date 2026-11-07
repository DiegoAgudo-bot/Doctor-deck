"use client";

import {
  GAME_CHANGER_LIMIT,
  bracketName,
  type Bracket,
  type BracketEstimate,
} from "@/domain/deck/bracket";
import { useLocale, useT } from "./i18n";

const TONE: Record<BracketEstimate["bracket"], string> = {
  2: "pill-in",
  3: "pill-warn",
  4: "pill-out",
};

/** Pastilla "Bracket 3 · Mejorado" para la cabecera del mazo. */
export function BracketPill({
  bracket,
  target,
  onClick,
}: {
  bracket: BracketEstimate;
  target: Bracket | null;
  onClick: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const over = target !== null && bracket.bracket > target;
  return (
    <button
      type="button"
      className={`pill ${over ? "pill-out" : TONE[bracket.bracket]}`}
      style={{ cursor: "pointer", border: "none" }}
      title={bracket.reasons.join(" · ")}
      onClick={onClick}
    >
      Bracket {bracket.bracket}
      {bracket.bracket === 4 ? "+" : ""} · {bracketName(bracket.bracket, locale)}
      {over && t(` (objetivo ${target})`, ` (target ${target})`)}
    </button>
  );
}

function CardList({ title, names, empty }: { title: string; names: string[]; empty?: string }) {
  if (names.length === 0 && !empty) return null;
  return (
    <div className="kv" style={{ alignItems: "flex-start" }}>
      <span className="muted" style={{ flex: "none" }}>
        {title}
      </span>
      <span className="text-right text-[13px]">
        {names.length > 0 ? names.join(", ") : <span className="subtle">{empty}</span>}
      </span>
    </div>
  );
}

/**
 * Pestaña de estadísticas: bracket estimado con su desglose, y el bracket objetivo (si se elige,
 * los cambios propuestos lo respetan).
 */
export function BracketPanel({
  bracket,
  target,
  busy,
  onTarget,
  canSetTarget,
}: {
  bracket: BracketEstimate;
  target: Bracket | null;
  busy: boolean;
  onTarget: (b: Bracket | null) => void;
  /** El mazo de otro no se puede configurar. */
  canSetTarget: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const gcLimit = target === null ? null : GAME_CHANGER_LIMIT[target];
  const over = target !== null && bracket.bracket > target;
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">
          Bracket {bracket.bracket}
          {bracket.bracket === 4 ? "+" : ""} · {bracketName(bracket.bracket, locale)}
        </span>
        <span className="subtle text-xs">
          {t("estimado con la lista", "estimated from the list")}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <ul className="flex flex-col gap-1 text-[13px]" style={{ listStyle: "none" }}>
          {bracket.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div>
          <CardList
            title={`Game changers${gcLimit !== null && Number.isFinite(gcLimit) ? ` (${t("máx.", "max.")} ${gcLimit})` : ""}`}
            names={bracket.gameChangers}
            empty={t("Ninguna", "None")}
          />
          <CardList
            title={t("Destrucción masiva de tierras", "Mass land denial")}
            names={bracket.massLandDenial}
          />
          <CardList title={t("Turnos extra", "Extra turns")} names={bracket.extraTurns} />
          <CardList
            title={t("Combos que lo suben", "Combos that raise it")}
            names={bracket.combos}
          />
          <CardList title={t("Tutores", "Tutors")} names={bracket.tutors} />
        </div>
        {over && (
          <p className="text-[13px]" style={{ color: "var(--color-out)" }}>
            {t(`Te pasas del bracket ${target}`, `You're over bracket ${target}`)}
            {bracket.gameChangers.length > (gcLimit ?? Infinity)
              ? `: ${t("quita", "remove")} ${bracket.gameChangers.length - (gcLimit ?? 0)} game changer${
                  bracket.gameChangers.length - (gcLimit ?? 0) > 1 ? "s" : ""
                }`
              : ""}
            {bracket.massLandDenial.length > 0
              ? t(" y la destrucción masiva de tierras", " and the mass land denial")
              : ""}
            .
          </p>
        )}
        <p className="subtle text-xs">
          {t(
            "Es el bracket mínimo según game changers, destrucción masiva de tierras, turnos extra",
            "It's the minimum bracket based on game changers, mass land denial, extra turns",
          )}
          {bracket.combosChecked
            ? t(" y combos", " and combos")
            : t(
                ". Los combos se están buscando o no se han podido comprobar",
                ". Combos are still being checked or couldn't be checked",
              )}
          .{" "}
          {t(
            "El 1 (temático) y el 5 (cEDH) dependen de la intención del mazo.",
            "1 (exhibition) and 5 (cEDH) depend on the deck's intent.",
          )}
        </p>
        {canSetTarget && (
          <div className="field border-t border-line pt-3">
            <span className="label">{t("Bracket objetivo", "Target bracket")}</span>
            <div
              className="chips"
              role="radiogroup"
              aria-label={t("Bracket objetivo", "Target bracket")}
            >
              {([null, 1, 2, 3, 4, 5] as const).map((b) => (
                <button
                  key={b ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={target === b}
                  disabled={busy}
                  className={`chipbtn ${target === b ? "is-on" : ""}`}
                  onClick={() => onTarget(b)}
                >
                  {b === null ? t("Sin objetivo", "No target") : `${b} · ${bracketName(b, locale)}`}
                </button>
              ))}
            </div>
            <span className="hint">
              {t(
                "Con un objetivo, los cambios propuestos no meten game changers por encima de su límite (0 hasta el 2, 3 en el 3) ni destrucción masiva de tierras por debajo del 4.",
                "With a target, suggested changes won't add game changers above its limit (0 up to 2, 3 in bracket 3) or mass land denial below 4.",
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
