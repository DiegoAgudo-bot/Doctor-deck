import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

/** `url` en formato Prisma (`file:./data/x.db`) o ruta directa. */
export function createDb(url: string): Db {
  const file = url.replace(/^file:/, "");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
}
