import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import streamArray from "stream-json/streamers/stream-array.js";
import { z } from "zod";
import type { HttpClient } from "../http/http-client";

export const SCRYFALL_BULK_INDEX = "https://api.scryfall.com/bulk-data";
export type BulkType = "oracle_cards" | "default_cards";

const bulkIndexSchema = z.object({
  data: z.array(
    z.object({
      type: z.string(),
      download_uri: z.string().url(),
      updated_at: z.string(),
      size: z.number().optional(),
    }),
  ),
});

export interface BulkFile {
  type: BulkType;
  path: string;
  updatedAt: string;
  downloaded: boolean;
}

/**
 * Descarga el bulk `type` a `dir` solo si Scryfall tiene una versión más nueva que la guardada.
 * Guarda `{type}.json` y `{type}.meta.json` (con `updated_at`).
 */
export async function ensureBulkFile(
  http: HttpClient,
  dir: string,
  type: BulkType,
  force = false,
): Promise<BulkFile> {
  const index = bulkIndexSchema.parse(await http.getJson(SCRYFALL_BULK_INDEX));
  const entry = index.data.find((d) => d.type === type);
  if (!entry) throw new Error(`Scryfall no ofrece el bulk "${type}"`);

  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${type}.json`);
  const metaFile = path.join(dir, `${type}.meta.json`);
  const local = await readMeta(metaFile);
  if (!force && local?.updatedAt === entry.updated_at) {
    return { type, path: file, updatedAt: entry.updated_at, downloaded: false };
  }

  const res = await http.get(entry.download_uri);
  if (!res.body) throw new Error(`Respuesta vacía al descargar ${entry.download_uri}`);
  const tmp = `${file}.part`;
  await pipeline(
    Readable.fromWeb(res.body as WebReadableStream<Uint8Array>),
    createWriteStream(tmp),
  );
  await rename(tmp, file);
  await writeFile(metaFile, JSON.stringify({ updatedAt: entry.updated_at }));
  return { type, path: file, updatedAt: entry.updated_at, downloaded: true };
}

async function readMeta(metaFile: string): Promise<{ updatedAt: string } | null> {
  try {
    return z.object({ updatedAt: z.string() }).parse(JSON.parse(await readFile(metaFile, "utf8")));
  } catch {
    return null;
  }
}

/** Recorre un array JSON enorme elemento a elemento sin cargarlo entero en memoria. */
export async function* readJsonArray(file: string): AsyncGenerator<unknown> {
  const stream = createReadStream(file).pipe(streamArray.withParserAsStream());
  for await (const item of stream as AsyncIterable<{ value: unknown }>) {
    yield item.value;
  }
}
