import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  closeSync,
  createReadStream,
  createWriteStream,
  openSync,
  readSync,
  statSync,
} from "node:fs";
import { request } from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";

/*
 * Copia de seguridad fuera del VPS: la copia comprimida se cifra (AES-256-GCM, clave derivada de
 * BACKUP_PASSPHRASE con scrypt) y se sube a un almacenamiento compatible con S3 (Backblaze B2,
 * Cloudflare R2…). El proveedor solo ve bytes cifrados: lleva emails y contraseñas cifradas.
 */

/** Cabecera del fichero cifrado: `DDB1` + sal (16) + IV (12); al final, la etiqueta GCM (16). */
const MAGIC = Buffer.from("DDB1");
const SALT = 16;
const IV = 12;
const TAG = 16;
const HEADER = MAGIC.length + SALT + IV;

const deriveKey = (passphrase: string, salt: Buffer) => scryptSync(passphrase, salt, 32);

export async function encryptFile(src: string, dest: string, passphrase: string): Promise<void> {
  const salt = randomBytes(SALT);
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const out = createWriteStream(dest);
  out.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(src), cipher, out, { end: false });
  await new Promise<void>((resolve, reject) => {
    out.on("error", reject);
    out.end(cipher.getAuthTag(), resolve);
  });
}

/** Lo contrario de `encryptFile`. Falla si la contraseña no es la buena o el fichero está dañado. */
export async function decryptFile(src: string, dest: string, passphrase: string): Promise<void> {
  const size = statSync(src).size;
  if (size < HEADER + TAG) throw new Error("El fichero es demasiado pequeño para ser una copia.");
  const head = Buffer.alloc(HEADER);
  const tag = Buffer.alloc(TAG);
  const fd = openSync(src, "r");
  try {
    readSync(fd, head, 0, HEADER, 0);
    readSync(fd, tag, 0, TAG, size - TAG);
  } finally {
    closeSync(fd);
  }
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("No es una copia cifrada de Doctor Deck.");
  }
  const salt = head.subarray(MAGIC.length, MAGIC.length + SALT);
  const iv = head.subarray(MAGIC.length + SALT);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(src, { start: HEADER, end: size - TAG - 1 }),
      decipher,
      createWriteStream(dest),
    );
  } catch {
    throw new Error("No se puede descifrar: la contraseña no es la buena o la copia está dañada.");
  }
}

/** Días que se guardan fuera (los mismos que promete la política de privacidad). */
export const OFFSITE_DAYS = 14;

/**
 * Nombre de la copia en el almacenamiento: uno de 14 que se van pisando (`deck-doctor-d00` …
 * `d13`), así no hace falta listar ni borrar nada y nunca hay más de 14 días.
 */
export function offsiteKey(now: Date, prefix = ""): string {
  const day = Math.floor(now.getTime() / 86_400_000) % OFFSITE_DAYS;
  return `${prefix}deck-doctor-d${String(day).padStart(2, "0")}.db.gz.enc`;
}

export interface S3Target {
  /** p. ej. https://s3.eu-central-003.backblazeb2.com o https://<cuenta>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  /** `auto` en R2; en B2, la de su endpoint (eu-central-003…). */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();
/** Codificación de rutas de S3: todo menos letras, números, `-_.~` y `/`. */
const encodePath = (p: string) =>
  p
    .split("/")
    .map((s) =>
      encodeURIComponent(s).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");

/**
 * Firma AWS Signature V4 de una petición sin query. `headers` son las que se firman (en
 * minúsculas, `host` incluida). Devuelve la cabecera `Authorization`.
 */
export function signV4(opts: {
  method: string;
  path: string;
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `20130524T000000Z` */
  amzDate: string;
}): string {
  const service = opts.service ?? "s3";
  const names = Object.keys(opts.headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lower = Object.fromEntries(
    Object.entries(opts.headers).map(([k, v]) => [k.toLowerCase(), v.trim()]),
  );
  const canonical = [
    opts.method,
    encodePath(opts.path),
    "",
    ...names.map((h) => `${h}:${lower[h]}`),
    "",
    names.join(";"),
    opts.payloadHash,
  ].join("\n");
  const date = opts.amzDate.slice(0, 8);
  const scope = `${date}/${opts.region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", opts.amzDate, scope, sha256(canonical)].join("\n");
  let key = hmac(`AWS4${opts.secretAccessKey}`, date);
  for (const part of [opts.region, service, "aws4_request"]) key = hmac(key, part);
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
}

async function fileSha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

/** Sube un fichero (`PUT`, con estilo de ruta: `endpoint/bucket/key`). */
export async function putObject(target: S3Target, key: string, file: string, now = new Date()) {
  const url = new URL(target.endpoint);
  const objectPath = path.posix.join("/", url.pathname, target.bucket, key);
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const payloadHash = await fileSha256(file);
  const size = statSync(file).size;
  const signed = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const authorization = signV4({
    method: "PUT",
    path: objectPath,
    headers: signed,
    payloadHash,
    region: target.region,
    accessKeyId: target.accessKeyId,
    secretAccessKey: target.secretAccessKey,
    amzDate,
  });
  await new Promise<void>((resolve, reject) => {
    const req = request(
      {
        method: "PUT",
        hostname: url.hostname,
        port: url.port || 443,
        path: encodePath(objectPath),
        headers: {
          ...signed,
          authorization,
          "content-length": String(size),
          "content-type": "application/octet-stream",
        },
        timeout: 10 * 60_000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (body += c.slice(0, 2000)));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) resolve();
          else
            reject(new Error(`El almacenamiento ha respondido ${status}: ${body.slice(0, 500)}`));
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Tiempo agotado subiendo la copia.")));
    req.on("error", reject);
    createReadStream(file).on("error", reject).pipe(req);
  });
}

/** Configuración de la copia externa desde las variables de entorno; null si falta alguna. */
export function offsiteConfig(
  env: Record<string, string | undefined>,
): { target: S3Target; passphrase: string; prefix: string } | null {
  const get = (k: string) => env[k]?.trim() || undefined;
  const endpoint = get("BACKUP_S3_ENDPOINT");
  const bucket = get("BACKUP_S3_BUCKET");
  const accessKeyId = get("BACKUP_S3_ACCESS_KEY_ID");
  const secretAccessKey = get("BACKUP_S3_SECRET_ACCESS_KEY");
  const passphrase = get("BACKUP_PASSPHRASE");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !passphrase) return null;
  return {
    target: {
      endpoint: /^https:\/\//.test(endpoint) ? endpoint : `https://${endpoint}`,
      bucket,
      region: get("BACKUP_S3_REGION") ?? "auto",
      accessKeyId,
      secretAccessKey,
    },
    passphrase,
    prefix: get("BACKUP_S3_PREFIX") ?? "",
  };
}
