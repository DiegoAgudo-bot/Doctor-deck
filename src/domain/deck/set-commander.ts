import { frontFace, nameKey } from "../cards/names";
import { parseDecklist } from "./decklist";

const COMMANDER_HEADER = /^(\/\/|#)?\s*commanders?\s*(\(\d+\))?\s*:?\s*$/i;
const CMDR_MARK = /\s*\*CMDR\*/gi;

/** Quita la categoría «Commander» de Archidekt (`[Commander{top}]`, `[Commander,Ramp]`). */
function withoutCommanderCategory(line: string): string {
  return line.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const kept = inner
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c !== "" && !/^commander/i.test(c));
    return kept.length > 0 ? `[${kept.join(",")}]` : "";
  });
}

const sameCard = (a: string, b: string) =>
  nameKey(a) === nameKey(b) || nameKey(frontFace(a)) === nameKey(frontFace(b));

/**
 * Pone `names` como comandante(s) de una lista en texto, aunque la lista no los traiga: los que ya
 * marcaba como comandante pasan al mazo, la línea de la carta elegida (si estaba en el mazo) sube a
 * una sección «Commander» con su edición, y el resto queda bajo «Deck».
 */
export function decklistWithCommanders(text: string, names: readonly string[]): string {
  const lines = text.split(/\r?\n/);
  const { entries } = parseDecklist(text);
  const commanderLines = names.map((name) => {
    const entry = entries.find(
      (e) => e.quantity === 1 && sameCard(e.name, name) && lines[e.line - 1] !== undefined,
    );
    if (!entry) return `1 ${name}`;
    const raw = withoutCommanderCategory(lines[entry.line - 1] ?? "")
      .replace(CMDR_MARK, "")
      .trim();
    lines[entry.line - 1] = "";
    return raw;
  });
  const rest = lines
    .map((line) =>
      COMMANDER_HEADER.test(line.trim())
        ? "Deck"
        : withoutCommanderCategory(line).replace(CMDR_MARK, "").trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return ["Commander", ...commanderLines, "", "Deck", rest].join("\n").trimEnd() + "\n";
}
