/**
 * Analiza un mazo y muestra los cambios sugeridos usando tu colección y EDHREC.
 * Uso: npm run deck:suggest -- "lista.txt" [--theme control] [--lock "Carta"]... [--commander "Nombre"]...
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { EdhrecError } from "@/adapters/edhrec/errors";
import { analyzeDeck } from "@/application/analyze-deck";
import { nameKey } from "@/domain/cards/names";
import { ROLE_LABELS, ROLES } from "@/domain/roles/types";
import { createContainer } from "@/server/container";

function args(flag: string): string[] {
  return process.argv.flatMap((a, i) =>
    a === flag && process.argv[i + 1] ? [process.argv[i + 1] as string] : [],
  );
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--"))
    throw new Error('Uso: npm run deck:suggest -- "lista.txt" [--theme x] [--lock "Carta"]');
  const c = createContainer();
  const input = /^https?:\/\//i.test(file) ? file : await readFile(file, "utf8");
  const deps = {
    sources: c.deckSources,
    cards: c.cards,
    collection: c.collection,
    recommendations: c.edhrec,
    classifier: c.classifier,
    config: c.engineConfig,
  };

  // Los nombres de --lock / --commander se traducen a oracleIds con el catálogo.
  const toIds = async (names: string[]) =>
    names.length === 0
      ? []
      : (await c.cards.findCardsByNameKeys(names.map(nameKey))).map((x) => x.oracleId);

  const result = await analyzeDeck(
    {
      input,
      theme: args("--theme")[0],
      locked: await toIds(args("--lock")),
      commanders: await toIds(args("--commander")),
    },
    deps,
  );
  if (result.status === "needs_commander") {
    console.log(
      'No se ha podido determinar el comandante. Repite con --commander "Nombre". Candidatos:',
    );
    for (const x of result.candidates) console.log(`  ${x.name}`);
    return;
  }

  const { suggestions: s, edhrec } = result;
  console.log(
    `Comandante: ${result.deck.commanders.map((x) => x.name).join(" + ")} · EDHREC: ${edhrec.totalDecks ?? "?"} mazos${edhrec.theme ? ` (tema ${edhrec.theme})` : ""}`,
  );
  if (edhrec.warning) console.log(`AVISO: ${edhrec.warning}`);
  console.log(
    `Curva: ${Object.entries(result.curve)
      .map(([k, v]) => `${k === "7" ? "7+" : k}:${v}`)
      .join(" ")}`,
  );
  console.log(`Roles: ${ROLES.map((r) => `${ROLE_LABELS[r]} ${s.roleCounts[r]}`).join(" · ")}`);
  for (const d of s.deficits)
    console.log(`  Por debajo del mínimo: ${ROLE_LABELS[d.role]} ${d.count}/${d.min}`);
  console.log(`\nCambios sugeridos (${s.swaps.length}):`);
  s.swaps.forEach((sw, i) =>
    console.log(
      `${String(i + 1).padStart(2)}. − ${sw.out.card.name}  + ${sw.in.card.name}\n    ${sw.reason}`,
    ),
  );
  if (s.swaps.length === 0)
    console.log(
      "  Ninguno: no hay cartas de tu colección que mejoren el mazo con la configuración actual.",
    );
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  if (err instanceof EdhrecError) console.error(`EDHREC [${err.code}] ${err.message}`);
  else console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
