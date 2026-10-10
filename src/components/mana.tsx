/* eslint-disable @next/next/no-img-element -- símbolos SVG estáticos */

/**
 * Los símbolos se sirven desde nuestro servidor (`public/symbols/`, `npm run symbols:sync`), no
 * desde svgs.scryfall.io: va detrás de Cloudflare, que en España se bloquea en los partidos de
 * LaLiga.
 */
export const SYMBOL_URL = "/symbols/";

/** "{2}{B/G}{R}" → ["2", "BG", "R"] (nombres de fichero de Scryfall: sin "/"). */
export function manaSymbols(cost: string | null | undefined): string[] {
  if (!cost) return [];
  // Cartas de dos caras: solo el coste de la cara frontal.
  const front = cost.split("//")[0] ?? "";
  return [...front.matchAll(/\{([^}]+)\}/g)].map((m) => (m[1] ?? "").replace(/\//g, ""));
}

const LABEL: Record<string, string> = {
  W: "blanco",
  U: "azul",
  B: "negro",
  R: "rojo",
  G: "verde",
  C: "incoloro",
};

function Symbol({ s }: { s: string }) {
  return <img src={`${SYMBOL_URL}${encodeURIComponent(s)}.svg`} alt={`{${s}}`} loading="lazy" />;
}

/** Coste de maná con los símbolos oficiales. */
export function ManaCost({ cost, large = false }: { cost: string | null; large?: boolean }) {
  const symbols = manaSymbols(cost);
  if (symbols.length === 0) return null;
  return (
    <span className={`mana${large ? " ms-lg" : ""}`}>
      {symbols.map((s, i) => (
        <Symbol key={i} s={s} />
      ))}
    </span>
  );
}

/** Identidad de color (WUBRG; vacía = incolora). */
export function ColorPips({
  colors,
  className = "mana",
}: {
  colors: readonly string[];
  className?: string;
}) {
  const list = colors.length > 0 ? colors : ["C"];
  return (
    <span
      className={className}
      aria-label={`Identidad: ${list.map((c) => LABEL[c] ?? c).join(", ")}`}
    >
      {list.map((c) => (
        <Symbol key={c} s={c} />
      ))}
    </span>
  );
}
