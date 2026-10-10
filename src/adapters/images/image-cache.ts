import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isScryfallImagePath, SCRYFALL_IMAGE_ORIGIN } from "@/domain/cards/images";
import type { ImageStore } from "@/domain/ports/image-store";
import type { HttpClient } from "../http/http-client";

const contentTypeOf = (p: string) => (p.endsWith(".png") ? "image/png" : "image/jpeg");

/**
 * Caché en disco de las imágenes de Scryfall (`dir/<ruta de Scryfall>`). Con un tope de tamaño:
 * al llegar, se siguen sirviendo las nuevas (sin guardarlas) y las guardadas.
 */
export class FileImageCache implements ImageStore {
  private size: Promise<number> | null = null;

  constructor(
    private readonly dir: string,
    private readonly maxBytes: number,
    private readonly http: HttpClient,
  ) {}

  async get(imagePath: string) {
    if (!isScryfallImagePath(imagePath)) return null;
    const file = path.join(this.dir, imagePath);
    try {
      return { body: await readFile(file), contentType: contentTypeOf(imagePath), cached: true };
    } catch {
      // No la teníamos: a Scryfall.
    }
    let body: Uint8Array;
    try {
      const res = await this.http.get(`${SCRYFALL_IMAGE_ORIGIN}/${imagePath}`);
      body = new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
    await this.save(file, body);
    return { body, contentType: contentTypeOf(imagePath), cached: false };
  }

  private async save(file: string, body: Uint8Array) {
    const used = await (this.size ??= this.measure());
    if (used + body.byteLength > this.maxBytes) return;
    this.size = Promise.resolve(used + body.byteLength);
    try {
      await mkdir(path.dirname(file), { recursive: true });
      // Escribir y renombrar: nunca se sirve una imagen a medio escribir.
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, file);
    } catch {
      // Sin disco o sin permisos: se sirve igual, sin guardar.
    }
  }

  /** Lo que ocupa la caché (una vez por arranque). */
  private async measure(): Promise<number> {
    let total = 0;
    const walk = async (d: string) => {
      let entries;
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else total += (await stat(p)).size;
      }
    };
    await walk(this.dir);
    return total;
  }
}
