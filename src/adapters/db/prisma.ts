import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

/**
 * Tablas cuyos cambios afectan a lo que se calcula de la colección de alguien (copias, mazos que la
 * usan, préstamos, roles corregidos y catálogo). Cualquier escritura en ellas sube `dataEpoch`, y
 * las cachés en memoria (`server/memo-cache.ts`) dejan de valer.
 */
const TRACKED = new Set([
  "CollectionEntry",
  "Deck",
  "DeckCard",
  "Loan",
  "CardRoleOverride",
  "DeckRoleOverride",
  "OracleCard",
  "Printing",
  "CardOtag",
]);
const WRITES = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

let epoch = 0;
/** Sube con cada escritura en las tablas de `TRACKED` (y con SQL directo, por si acaso). */
export const dataEpoch = () => epoch;

/** `url` en formato Prisma (`file:./data/x.db`) o ruta directa. */
export function createDb(url: string): Db {
  const file = url.replace(/^file:/, "");
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (TRACKED.has(model) && WRITES.has(operation)) epoch += 1;
          return result;
        },
      },
      async $executeRaw({ args, query }) {
        const result = await query(args);
        epoch += 1;
        return result;
      },
      async $executeRawUnsafe({ args, query }) {
        const result = await query(args);
        epoch += 1;
        return result;
      },
    },
  }) as unknown as Db;
}
