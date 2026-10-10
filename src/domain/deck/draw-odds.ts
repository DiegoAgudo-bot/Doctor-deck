/**
 * Probabilidades de la mano inicial y de los primeros robos (distribución hipergeométrica) y manos
 * de muestra. La biblioteca son las 99: los comandantes empiezan en la zona de mando.
 *
 * En Commander multijugador nadie se salta el robo del primer turno (regla 103.8c), así que en el
 * turno T has visto 7 + T cartas.
 */

/** Coeficiente binomial C(n, k) en coma flotante (n ≤ ~200 sin problemas). */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - Math.min(k, n - k) + i)) / i;
  return r;
}

/** P(exactamente `k` éxitos) al robar `n` de `population` cartas con `successes` éxitos. */
export function hypergeometric(population: number, successes: number, n: number, k: number) {
  const draws = Math.min(n, population);
  const total = choose(population, draws);
  return total === 0
    ? 0
    : (choose(successes, k) * choose(population - successes, draws - k)) / total;
}

/** P(al menos `k` éxitos). */
export function atLeast(population: number, successes: number, n: number, k: number) {
  let p = 0;
  for (let i = k; i <= Math.min(n, successes); i++)
    p += hypergeometric(population, successes, n, i);
  return Math.min(1, p);
}

export const HAND_SIZE = 7;
/** Cartas vistas al llegar al turno `turn` (mano de 7 + un robo por turno). */
export const seenByTurn = (turn: number) => HAND_SIZE + turn;

export interface OpeningHandOdds {
  library: number;
  lands: number;
  /** P(exactamente i tierras en la mano inicial), i = 0..7. */
  landsInHand: number[];
  /** P(entre 2 y 4 tierras en la mano inicial): una mano que se queda sin pensarlo. */
  keepable: number;
  /** P(al menos 3 tierras en el turno 3) y P(al menos 4 en el turno 4). */
  landDropT3: number;
  landDropT4: number;
  /** P(al menos una carta de ramp en la mano inicial / en el turno 2). */
  rampInHand: number;
  rampByT2: number;
  /** P(al menos una carta de robo en el turno 3). */
  drawByT3: number;
}

export function openingHandOdds(counts: {
  library: number;
  lands: number;
  ramp: number;
  draw: number;
}): OpeningHandOdds {
  const { library: n, lands, ramp, draw } = counts;
  const landsInHand = Array.from({ length: HAND_SIZE + 1 }, (_, i) =>
    hypergeometric(n, lands, HAND_SIZE, i),
  );
  return {
    library: n,
    lands,
    landsInHand,
    keepable: landsInHand.slice(2, 5).reduce((a, b) => a + b, 0),
    landDropT3: atLeast(n, lands, seenByTurn(3), 3),
    landDropT4: atLeast(n, lands, seenByTurn(4), 4),
    rampInHand: atLeast(n, ramp, HAND_SIZE, 1),
    rampByT2: atLeast(n, ramp, seenByTurn(2), 1),
    drawByT3: atLeast(n, draw, seenByTurn(3), 1),
  };
}

/**
 * Baraja la biblioteca (una entrada por copia). `random` devuelve [0, 1) como `Math.random`; se
 * inyecta para poder probarlo.
 */
export function shuffleLibrary<T extends { quantity: number }>(
  cards: readonly T[],
  random: () => number,
): T[] {
  const library = cards.flatMap((c) => Array.from({ length: c.quantity }, () => c));
  for (let i = library.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [library[i], library[j]] = [library[j] as T, library[i] as T];
  }
  return library;
}
