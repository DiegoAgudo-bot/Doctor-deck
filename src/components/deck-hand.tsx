"use client";

import { useMemo, useState } from "react";
import { HAND_SIZE, openingHandOdds, shuffleLibrary } from "@/domain/deck/draw-odds";
import type { DeckCardDTO } from "@/server/dto";
import { CardImage } from "./card-image";

const pct = (p: number) => `${Math.round(p * 100)} %`;
const count = (cards: DeckCardDTO[], role: DeckCardDTO["primaryRole"]) =>
  cards
    .filter((c) => c.roles.includes(role) && (role === "land" || !c.roles.includes("land")))
    .reduce((n, c) => n + c.quantity, 0);

/**
 * Pestaña de estadísticas: probabilidades de la mano inicial (tierras, ramp, robo) y manos de
 * muestra con mulligan (en Commander el primero es gratis).
 */
export function OpeningHand({ cards }: { cards: DeckCardDTO[] }) {
  const odds = useMemo(
    () =>
      openingHandOdds({
        library: cards.reduce((n, c) => n + c.quantity, 0),
        lands: count(cards, "land"),
        ramp: count(cards, "ramp"),
        draw: count(cards, "draw"),
      }),
    [cards],
  );
  const [library, setLibrary] = useState<DeckCardDTO[] | null>(null);
  const [seen, setSeen] = useState(HAND_SIZE);
  const [mulligans, setMulligans] = useState(0);

  function draw(mulligan: boolean) {
    setLibrary(shuffleLibrary(cards, Math.random));
    setSeen(HAND_SIZE);
    setMulligans((m) => (mulligan ? m + 1 : 0));
  }

  const hand = library?.slice(0, seen) ?? [];
  const landsInHand = hand.slice(0, HAND_SIZE).filter((c) => c.roles.includes("land")).length;
  // London mulligan; en Commander el primero es gratis.
  const toBottom = Math.max(0, mulligans - 1);
  const maxBar = Math.max(...odds.landsInHand);

  if (odds.library === 0) return null;
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="h2">Mano inicial</span>
        <span className="subtle text-xs">
          {odds.lands} tierras en {odds.library} cartas
        </span>
      </div>
      <div
        className="grid-1-sm grid gap-4 p-3"
        style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
      >
        <div>
          <div className="kv">
            <span className="muted">Mano de 2 a 4 tierras</span>
            <b>{pct(odds.keepable)}</b>
          </div>
          <div className="kv">
            <span className="muted">3 tierras en el turno 3</span>
            <b>{pct(odds.landDropT3)}</b>
          </div>
          <div className="kv">
            <span className="muted">4 tierras en el turno 4</span>
            <b>{pct(odds.landDropT4)}</b>
          </div>
          <div className="kv">
            <span className="muted">Ramp en la mano / en el turno 2</span>
            <b>
              {pct(odds.rampInHand)} / {pct(odds.rampByT2)}
            </b>
          </div>
          <div className="kv">
            <span className="muted">Robo en el turno 3</span>
            <b>{pct(odds.drawByT3)}</b>
          </div>
          <p className="subtle mt-2 text-xs">
            En multijugador todos roban en su primer turno: en el turno T has visto 7 + T cartas.
          </p>
        </div>
        <div className="flex flex-col gap-1.5" aria-label="Tierras en la mano inicial">
          <span className="cap">Tierras en la mano de 7</span>
          {odds.landsInHand.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="mono subtle" style={{ width: 12 }}>
                {i}
              </span>
              <div className="role-bar flex-1" style={{ height: 8 }}>
                <i
                  style={{
                    width: `${maxBar ? (p / maxBar) * 100 : 0}%`,
                    background: i >= 2 && i <= 4 ? undefined : "var(--color-line-strong)",
                  }}
                />
              </div>
              <span className="mono subtle" style={{ width: 36, textAlign: "right" }}>
                {pct(p)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => draw(false)}>
            {library ? "Nueva mano" : "Robar 7"}
          </button>
          {library && (
            <>
              <button type="button" className="btn" onClick={() => draw(true)}>
                Mulligan
              </button>
              <button
                type="button"
                className="btn"
                disabled={seen >= library.length}
                onClick={() => setSeen((s) => s + 1)}
              >
                Robar una
              </button>
              <span className="subtle text-xs">
                {landsInHand} {landsInHand === 1 ? "tierra" : "tierras"} en la mano
                {mulligans > 0 &&
                  ` · ${mulligans} mulligan${mulligans > 1 ? "s" : ""}${
                    toBottom ? `: pon ${toBottom} al fondo` : " (gratis)"
                  }`}
                {seen > HAND_SIZE && ` · turno ${seen - HAND_SIZE}`}
              </span>
            </>
          )}
        </div>
        {hand.length > 0 && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
          >
            {hand.map((c, i) => (
              <CardImage
                key={`${c.card.oracleId}-${i}`}
                card={c.card}
                style={i >= HAND_SIZE ? { outline: "2px solid var(--color-accent)" } : {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
