/** Una línea de carta de una lista de mazo pegada como texto. */
export interface DecklistEntry {
  line: number;
  quantity: number;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
  /** Scryfall ID de la impresión, si la fuente lo da (Archidekt, Moxfield). */
  scryfallId?: string | null;
  foil: boolean;
  /** Marcada explícitamente como comandante (sección, `*CMDR*` o categoría de Archidekt). */
  commander: boolean;
}

export interface SkippedLine {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedDecklist {
  /** Nombre del mazo, si la fuente lo da. */
  name?: string | null;
  entries: DecklistEntry[];
  /** Líneas que no son cartas del mazo (banquillo, maybeboard, basura…), para informar al usuario. */
  skipped: SkippedLine[];
}

type Section = "main" | "commander" | "excluded" | "about";

const SECTION_ALIASES: Record<string, Section> = {
  commander: "commander",
  commanders: "commander",
  deck: "main",
  main: "main",
  maindeck: "main",
  mainboard: "main",
  sideboard: "excluded",
  maybeboard: "excluded",
  considering: "excluded",
  companion: "excluded",
  tokens: "excluded",
  about: "about",
};

/**
 * Reconoce cabeceras de sección: "Commander", "Commander:", "// Commander",
 * "COMMANDER (1)", "Sideboard", etc.
 */
function sectionHeader(text: string): Section | null {
  const key = text
    .replace(/^(\/\/|#)\s*/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s*:\s*$/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return SECTION_ALIASES[key] ?? null;
}

const QTY_RE = /^(\d+)\s*[xX]?\s+(.+)$/;
const SET_RE = /^(.+?)\s+\(([A-Za-z0-9]{2,8})\)(?:\s+(\S+))?$/;
const CATEGORY_RE = /\[([^\]]*)\]/g;

interface Markers {
  text: string;
  foil: boolean;
  commander: boolean;
  excluded: boolean;
}

/** Extrae marcadores de distintos exportadores y devuelve el texto limpio. */
function stripMarkers(input: string): Markers {
  let text = input;
  let foil = false;
  let commander = false;
  let excluded = false;

  // Archidekt: "[Commander{top}]", "[Maybeboard{noDeck}{noPrice}]", "[Ramp,Draw]"
  for (const m of text.matchAll(CATEGORY_RE)) {
    const cats = (m[1] ?? "").split(",").map((c) => c.trim().toLowerCase());
    if (cats.some((c) => c.startsWith("commander"))) commander = true;
    if (cats.some((c) => c.includes("{nodeck}") || /^(maybeboard|sideboard)\b/.test(c))) {
      excluded = true;
    }
  }
  text = text.replace(CATEGORY_RE, " ");
  // Archidekt: etiquetas de color "^Have,#37d67a^"
  text = text.replace(/\^[^^]*\^/g, " ");
  // Moxfield / MTGO: *CMDR*, *F* (foil), *E* (etched)
  if (/\*CMDR\*/i.test(text)) commander = true;
  if (/\*[FE]\*/.test(text)) foil = true;
  text = text.replace(/\*(CMDR|F|E)\*/gi, " ");
  // Etiquetas Moxfield "#!Ramp #draw"
  text = text.replace(/\s#!?\S+/g, " ");

  return { text: text.replace(/\s+/g, " ").trim(), foil, commander, excluded };
}

/**
 * Parsea una lista de mazo en texto. Formatos admitidos (mezclables):
 * `1 Sol Ring`, `1x Sol Ring`, `Sol Ring`, `1 Sol Ring (C21) 263`, `1 Sol Ring (C21) 263 *F*`,
 * `SB: 1 Card`, secciones Commander/Deck/Sideboard/Maybeboard, `*CMDR*` y las categorías de Archidekt.
 */
export function parseDecklist(text: string): ParsedDecklist {
  const entries: DecklistEntry[] = [];
  const skipped: SkippedLine[] = [];
  let section: Section = "main";

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    let t = rawLine.trim();
    if (t === "") return;

    const header = sectionHeader(t);
    if (header) {
      section = header;
      return;
    }
    if (section === "about") return; // "Name Mi mazo" del formato Arena
    if (t.startsWith("#") || t.startsWith("//")) return; // comentarios

    let lineSection: Section = section;
    if (/^SB:\s*/i.test(t)) {
      lineSection = "excluded";
      t = t.replace(/^SB:\s*/i, "");
    }

    const markers = stripMarkers(t);
    if (markers.excluded) lineSection = "excluded";

    let rest = markers.text;
    let quantity = 1;
    const qty = QTY_RE.exec(rest);
    if (qty) {
      quantity = Number(qty[1]);
      rest = qty[2] ?? "";
    }

    let setCode: string | null = null;
    let collectorNumber: string | null = null;
    const set = SET_RE.exec(rest);
    if (set) {
      rest = set[1] ?? rest;
      setCode = set[2]?.toLowerCase() ?? null;
      collectorNumber = set[3] ?? null;
    }

    const name = rest.trim();
    if (name === "" || quantity <= 0 || /^\d+$/.test(name)) {
      skipped.push({ line, text: rawLine, reason: "No se reconoce como carta" });
      return;
    }
    if (lineSection === "excluded") {
      skipped.push({ line, text: rawLine, reason: "Fuera del mazo (banquillo/maybeboard)" });
      return;
    }

    entries.push({
      line,
      quantity,
      name,
      setCode,
      collectorNumber,
      foil: markers.foil,
      commander: lineSection === "commander" || markers.commander,
    });
  });

  return { entries, skipped };
}
