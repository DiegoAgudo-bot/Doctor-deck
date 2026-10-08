import type { Card } from "../cards/types";
import { ROLES, type Role, type RoleClassifier, type RoleSet } from "./types";

/** Orden de preferencia para elegir el rol principal cuando una carta cumple varios. */
const PRIMARY_ORDER: readonly Role[] = [
  "land",
  "wipe",
  "counterspell",
  "removal",
  "tutor",
  "ramp",
  "draw",
  "protection",
  "synergy",
];

const PERMANENT_NOUN = String.raw`(?:creature|artifact|enchantment|planeswalker|battle|permanent)s?`;
const BASIC_TYPES = String.raw`(?:plains|island|swamp|mountain|forest)`;

/** Texto preparado: minúsculas, sin reminder text, nombre propio → "this". */
function prepare(card: Card): string {
  let text = (card.oracleText ?? "").toLowerCase();
  for (const n of card.name.toLowerCase().split(" // ")) {
    if (n) text = text.split(n).join("this");
  }
  return text.replace(/\([^)]*\)/g, " ").replace(/[ \t]+/g, " ");
}

/** Cara frontal del tipo (en MDFC "Instant // Land" cuenta la cara que se juega normalmente). */
const frontType = (card: Card) => (card.typeLine.split("//")[0] ?? "").toLowerCase();

const RULES: Record<Exclude<Role, "land" | "synergy">, RegExp[]> = {
  ramp: [
    // Habilidades de maná en permanentes que no son tierra: "{T}: Add {C}{C}", "add one mana of any color"
    /(?:^|\n)[^\n]*:[^\n]*\badd (?:\{|one mana|two mana|three mana|x mana|an amount of)/,
    // Buscar tierras y ponerlas en el campo
    new RegExp(
      String.raw`search your library for [^.]*?(?:land|${BASIC_TYPES}) cards?[^.]*?onto the battlefield`,
    ),
    /put (?:a|up to \w+) land cards? from your hand onto the battlefield/,
    /you may play (?:an )?additional lands?/,
    /create (?:a|an|one|two|three|four|x|that many) (?:tapped )?treasure tokens?/,
  ],
  draw: [
    /\bdraws? (?:a|an|one|two|three|four|five|six|seven|x|that many|cards equal|\d+) (?:additional )?cards?/,
    /\bdraw cards equal/,
    // Robo "impulsivo" y selección: "exile the top N cards ... you may play/cast them"
    /exile the top [^.]*cards? of your library[^]*?you may (?:play|cast)/,
    /(?:look at|reveal) the top [^.]*cards? of your library[^]*?(?:put|into) [^.]*into your hand/,
    /\binvestigate\b/,
  ],
  removal: [
    new RegExp(
      String.raw`(?:destroy|exile) (?:up to (?:one|two|three) )?(?:another |other )?target (?:[\w-]+ )*?${PERMANENT_NOUN}(?! you control)(?! card)`,
    ),
    /deals? (?:\d+|x|that much) damage to (?:any target|target (?:[\w-]+ )*?(?:creature|planeswalker|battle))/,
    /target (?:[\w-]+ )*?creature (?:an opponent controls )?gets -(?:\d+|x)\/-(?:\d+|x)/,
    new RegExp(
      String.raw`return (?:up to \w+ )?(?:other )?target (?:[\w-]+ )*?${PERMANENT_NOUN}(?! you control)[^.]* to (?:its|their) owner'?s'? hands?`,
    ),
    /target (?:player|opponent) sacrifices/,
    /each opponent sacrifices (?:a|an|one) (?:creature|nonland permanent|permanent)/,
  ],
  wipe: [
    /(?:destroy|exile) (?:all|each) (?:other )?(?:[\w-]+ )*?(?:creatures|permanents|artifacts|enchantments|planeswalkers)/,
    /(?:destroy|exile) each (?:other )?(?:[\w-]+ )*?(?:creature|permanent|artifact|enchantment)/,
    /deals? (?:\d+|x|that much) damage to each creature/,
    /all (?:other )?creatures get -(?:\d+|x)\/-(?:\d+|x)/,
    /return (?:all|each) (?:other )?(?:[\w-]+ )*?(?:creatures|permanents)[^.]* to (?:its|their) owners'? hands?/,
    /each player sacrifices (?:all|that many|x)/,
  ],
  counterspell: [
    /\bcounter target (?:[\w-]+ )*?(?:spell|ability|abilities)/,
    /\bcounter (?:up to \w+ )?target spells?\b/,
  ],
  tutor: [
    /search your library for (?:a|an|up to \w+|any number of|x) (?!(?:basic )?lands?\b)(?![^.]*?(?:basic land|land cards?|plains|island|swamp|mountain|forest)\b)[^.]*?cards?/,
  ],
  protection: [
    /(?:gains?|have|has) (?:[\w ,]*?)(?:hexproof|indestructible|shroud|protection from)/,
    /phases? out/,
    /can't be the targets? of spells or abilities your opponents control/,
  ],
};

/** Clasificador por heurísticas sobre el oracle text y el tipo. */
export class HeuristicRoleClassifier implements RoleClassifier {
  classify(card: Card): RoleSet {
    const found = new Set<Role>();
    const type = frontType(card);
    const text = prepare(card);

    if (/\bland\b/.test(type)) {
      found.add("land");
    } else {
      for (const [role, patterns] of Object.entries(RULES) as [keyof typeof RULES, RegExp[]][]) {
        // Que robe el oponente ("whenever an opponent draws a card") no es robo para ti.
        const t =
          role === "draw"
            ? text.replace(/\b(?:an|each|target) opponents? draws?[^.,]*/g, "")
            : text;
        if (patterns.some((re) => re.test(t))) found.add(role);
      }
      // Las criaturas/permanentes con hexproof propio no son "protección": se exige conceder a otros.
      if (
        found.has("protection") &&
        !/(?:you control|equipped|enchanted|target)[^.]*(?:gains?|have|has)|phases? out|can't be the target/.test(
          text,
        )
      ) {
        found.delete("protection");
      }
    }
    if (found.size === 0) found.add("synergy");

    const roles = ROLES.filter((r) => found.has(r));
    const primary = PRIMARY_ORDER.find((r) => found.has(r)) ?? "synergy";
    return { roles, primary };
  }
}
