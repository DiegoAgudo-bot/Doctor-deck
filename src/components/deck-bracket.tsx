"use client";

import {
  BRACKET_NAMES,
  GAME_CHANGER_LIMIT,
  type Bracket,
  type BracketEstimate,
} from "@/domain/deck/bracket";

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
      {bracket.bracket === 4 ? "+" : ""} · {BRACKET_NAMES[bracket.bracket]}
      {over && ` (objetivo ${target})`}
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
  const gcLimit = target === null ? null : GAME_CHANGER_LIMIT[target];
  const over = target !== null && bracket.bracket > target;
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">
          Bracket {bracket.bracket}
          {bracket.bracket === 4 ? "+" : ""} · {BRACKET_NAMES[bracket.bracket]}
        </span>
        <span className="subtle text-xs">estimado con la lista</span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <ul className="flex flex-col gap-1 text-[13px]" style={{ listStyle: "none" }}>
          {bracket.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div>
          <CardList
            title={`Game changers${gcLimit !== null && Number.isFinite(gcLimit) ? ` (máx. ${gcLimit})` : ""}`}
            names={bracket.gameChangers}
            empty="Ninguna"
          />
          <CardList title="Destrucción masiva de tierras" names={bracket.massLandDenial} />
          <CardList title="Turnos extra" names={bracket.extraTurns} />
          <CardList title="Combos que lo suben" names={bracket.combos} />
          <CardList title="Tutores" names={bracket.tutors} />
        </div>
        {over && (
          <p className="text-[13px]" style={{ color: "var(--color-out)" }}>
            Te pasas del bracket {target}
            {bracket.gameChangers.length > (gcLimit ?? Infinity)
              ? `: quita ${bracket.gameChangers.length - (gcLimit ?? 0)} game changer${
                  bracket.gameChangers.length - (gcLimit ?? 0) > 1 ? "s" : ""
                }`
              : ""}
            {bracket.massLandDenial.length > 0 ? " y la destrucción masiva de tierras" : ""}.
          </p>
        )}
        <p className="subtle text-xs">
          Es el bracket mínimo según game changers, destrucción masiva de tierras, turnos extra
          {bracket.combosChecked
            ? " y combos (de Commander Spellbook)"
            : ". Los combos se están buscando o no se han podido comprobar"}
          . El 1 (temático) y el 5 (cEDH) dependen de la intención del mazo.
        </p>
        {canSetTarget && (
          <div className="field border-t border-line pt-3">
            <span className="label">Bracket objetivo</span>
            <div className="chips" role="radiogroup" aria-label="Bracket objetivo">
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
                  {b === null ? "Sin objetivo" : `${b} · ${BRACKET_NAMES[b]}`}
                </button>
              ))}
            </div>
            <span className="hint">
              Con un objetivo, los cambios propuestos no meten game changers por encima de su límite
              (0 hasta el 2, 3 en el 3) ni destrucción masiva de tierras por debajo del 4.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
