/**
 * Asigna a un usuario la colección y los mazos creados antes de que existieran los usuarios
 * (filas con userId vacío). Uso: npm run users:claim -- --user "email@ejemplo.com"
 */
import "dotenv/config";
import { createContainer } from "@/server/container";
import { resolveCliUser } from "./lib/cli-user";

async function main() {
  const c = createContainer();
  const user = await resolveCliUser(c.db);
  const [collection, decks] = await c.db.$transaction([
    c.db.collectionEntry.updateMany({ where: { userId: null }, data: { userId: user.id } }),
    c.db.deck.updateMany({ where: { userId: null }, data: { userId: user.id } }),
  ]);
  console.log(
    `Asignado a ${user.email}: ${collection.count} filas de colección y ${decks.count} mazos.`,
  );
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
