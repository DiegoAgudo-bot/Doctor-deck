import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { decryptFile, encryptFile, offsiteConfig, offsiteKey, signV4 } from "./offsite-backup";

const dir = mkdtempSync(path.join(tmpdir(), "deck-doctor-offsite-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("copia de seguridad externa", () => {
  it("cifra y descifra; con otra contraseña o el fichero tocado, falla", async () => {
    const src = path.join(dir, "copia.db.gz");
    const data = Buffer.from("datos de la copia ".repeat(5000));
    writeFileSync(src, data);
    const enc = path.join(dir, "copia.enc");
    await encryptFile(src, enc, "una contraseña larga");
    const raw = readFileSync(enc);
    expect(raw.subarray(0, 4).toString()).toBe("DDB1");
    expect(raw.includes(Buffer.from("datos de la copia"))).toBe(false);

    const out = path.join(dir, "vuelta.db.gz");
    await decryptFile(enc, out, "una contraseña larga");
    expect(readFileSync(out).equals(data)).toBe(true);

    await expect(decryptFile(enc, out, "otra")).rejects.toThrow(/contraseña/);
    const broken = Buffer.from(raw);
    broken[100] = (broken[100] ?? 0) ^ 1;
    writeFileSync(enc, broken);
    await expect(decryptFile(enc, out, "una contraseña larga")).rejects.toThrow(/dañada/);
  });

  it("14 nombres que se van pisando: el mismo cada 14 días", () => {
    const a = offsiteKey(new Date("2026-11-06T03:15:00Z"));
    expect(a).toMatch(/^deck-doctor-d\d\d\.db\.gz\.enc$/);
    expect(offsiteKey(new Date("2026-11-20T03:15:00Z"))).toBe(a);
    expect(offsiteKey(new Date("2026-11-07T03:15:00Z"))).not.toBe(a);
    expect(offsiteKey(new Date("2026-11-06T03:15:00Z"), "doctordeck/")).toBe(`doctordeck/${a}`);
  });

  it("firma AWS V4 igual que el ejemplo de la documentación de S3 (GET Object)", () => {
    const auth = signV4({
      method: "GET",
      path: "/test.txt",
      headers: {
        host: "examplebucket.s3.amazonaws.com",
        range: "bytes=0-9",
        "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "x-amz-date": "20130524T000000Z",
      },
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      amzDate: "20130524T000000Z",
    });
    expect(auth).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, " +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("solo se activa con todas las variables", () => {
    const env = {
      BACKUP_S3_ENDPOINT: "s3.eu-central-003.backblazeb2.com",
      BACKUP_S3_BUCKET: "copias",
      BACKUP_S3_ACCESS_KEY_ID: "id",
      BACKUP_S3_SECRET_ACCESS_KEY: "secreto",
      BACKUP_PASSPHRASE: "clave",
      BACKUP_S3_REGION: "eu-central-003",
    };
    expect(offsiteConfig(env)?.target).toMatchObject({
      endpoint: "https://s3.eu-central-003.backblazeb2.com",
      region: "eu-central-003",
    });
    expect(offsiteConfig({ ...env, BACKUP_PASSPHRASE: "" })).toBeNull();
  });
});
