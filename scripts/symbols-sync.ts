/**
 * Descarga los símbolos de maná de Scryfall (`/symbology`) a `public/symbols/` para servirlos
 * desde nuestro servidor (svgs.scryfall.io va detrás de Cloudflare, que en España se bloquea
 * durante los partidos de LaLiga). Se suben al repositorio; basta con volver a ejecutarlo si
 * salen símbolos nuevos.
 * Uso: npm run symbols:sync
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createContainer } from "@/server/container";

const symbology = z.object({
  data: z.array(z.object({ symbol: z.string(), svg_uri: z.string().url().nullish() })),
});

async function main() {
  const c = createContainer();
  const dir = path.join(process.cwd(), "public", "symbols");
  await mkdir(dir, { recursive: true });
  const { data } = symbology.parse(
    await c.scryfallHttp.getJson("https://api.scryfall.com/symbology"),
  );
  let saved = 0;
  for (const s of data) {
    if (!s.svg_uri) continue;
    const file = path.basename(new URL(s.svg_uri).pathname);
    if (!/^[A-Za-z0-9½∞-]+\.svg$/.test(file)) continue;
    const svg = await (await c.scryfallHttp.get(s.svg_uri)).text();
    if (!svg.includes("<svg")) throw new Error(`${s.symbol}: no es un SVG`);
    await writeFile(path.join(dir, file), svg);
    saved += 1;
  }
  console.log(`${saved} símbolos guardados en public/symbols/.`);
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
