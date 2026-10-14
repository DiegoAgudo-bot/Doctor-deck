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

/** Escrituras de cada usuario (las que dicen `userId`): solo invalidan lo de ese usuario. */
const userEpochs = new Map<string, number>();

/**
 * Época de los datos de un usuario: cambia con sus escrituras y con las que no se sabe de quién
 * son (catálogo, cambios por id…), no con las de otros usuarios.
 */
export const userDataEpoch = (userId: string) => `${epoch}:${userEpochs.get(userId) ?? 0}`;

/** El `userId` de una escritura si lo dice (`where` o `data`, también en `createMany`). */
function writerOf(args: unknown): string | null {
  const a = args as { where?: { userId?: unknown }; data?: unknown } | undefined;
  if (typeof a?.where?.userId === "string") return a.where.userId;
  const data = Array.isArray(a?.data) ? a.data : [a?.data];
  const ids = new Set(
    data.map((d) => (d as { userId?: unknown } | undefined)?.userId).filter((u) => u !== undefined),
  );
  const [only] = ids;
  return ids.size === 1 && typeof only === "string" ? only : null;
}

function bump(model: string, args: unknown) {
  // El catálogo afecta a todos; lo demás, a quien lo escribe si se sabe.
  const user =
    model === "OracleCard" || model === "Printing" || model === "CardOtag" ? null : writerOf(args);
  if (user === null) epoch += 1;
  else userEpochs.set(user, (userEpochs.get(user) ?? 0) + 1);
}

/** `url` en formato Prisma (`file:./data/x.db`) o ruta directa. */
export function createDb(url: string): Db {
  const file = url.replace(/^file:/, "");
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (TRACKED.has(model) && WRITES.has(operation)) bump(model, args);
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
