import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import streamArray from "stream-json/streamers/stream-array.js";
import { z } from "zod";
import type { HttpClient } from "../http/http-client";

export const SCRYFALL_BULK_INDEX = "https://api.scryfall.com/bulk-data";
export type BulkType = "oracle_cards" | "default_cards";

// Scryfall sirve ahora los bulk como JSON Lines comprimido (`jsonl_download_uri`, .jsonl.gz); se
// mantiene `download_uri` (array JSON) por si vuelve o para índices antiguos.
const bulkIndexSchema = z.object({
  data: z.array(
    z
      .object({
        type: z.string(),
        jsonl_download_uri: z.string().url().optional(),
        download_uri: z.string().url().optional(),
        updated_at: z.string(),
      })
      .refine((e) => e.jsonl_download_uri ?? e.download_uri, {
        message: "Falta jsonl_download_uri/download_uri",
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
 * Guarda `{type}.jsonl.gz` (o `{type}.json` con el formato antiguo) y `{type}.meta.json` (con
 * `updated_at`). Para leerlo, `readBulkFile`.
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

  const jsonl = entry.jsonl_download_uri !== undefined;
  const url = entry.jsonl_download_uri ?? entry.download_uri ?? "";
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, jsonl ? `${type}.jsonl.gz` : `${type}.json`);
  const metaFile = path.join(dir, `${type}.meta.json`);
  const local = await readMeta(metaFile);
  if (!force && local?.updatedAt === entry.updated_at && (await exists(file))) {
    return { type, path: file, updatedAt: entry.updated_at, downloaded: false };
  }

  const res = await http.get(url);
  if (!res.body) throw new Error(`Respuesta vacía al descargar ${url}`);
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

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Lee un bulk descargado por `ensureBulkFile` según su extensión (.jsonl.gz o .json). */
export function readBulkFile(file: string): AsyncGenerator<unknown> {
  return file.endsWith(".jsonl.gz") ? readJsonLinesGz(file) : readJsonArray(file);
}

/** Recorre un fichero JSON Lines comprimido con gzip, objeto a objeto. */
export async function* readJsonLinesGz(file: string): AsyncGenerator<unknown> {
  const lines = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

/** Recorre un array JSON enorme elemento a elemento sin cargarlo entero en memoria. */
export async function* readJsonArray(file: string): AsyncGenerator<unknown> {
  const stream = createReadStream(file).pipe(streamArray.withParserAsStream());
  for await (const item of stream as AsyncIterable<{ value: unknown }>) {
    yield item.value;
  }
}
