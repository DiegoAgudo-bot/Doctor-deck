import { describe, expect, it } from "vitest";
import { AppError } from "@/application/errors";
import { readJson, readText } from "./body";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://x/", { method: "POST", body, headers });

describe("lectura del cuerpo con tope", () => {
  it("lee lo que cabe", async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
    expect(await readText(post("hola"), 10)).toBe("hola");
  });

  it("rechaza con 413 lo que pasa del tope, diga o no su tamaño", async () => {
    const big = "x".repeat(2000);
    await expect(readText(post(big), 1000)).rejects.toMatchObject({ status: 413 });
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 5; i++) c.enqueue(new TextEncoder().encode(big));
        c.close();
      },
    });
    const req = new Request("http://x/", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readText(req, 5000)).rejects.toMatchObject({ code: "too_large" });
  });

  it("JSON roto → 400", async () => {
    await expect(readJson(post("{no"))).rejects.toBeInstanceOf(AppError);
    await expect(readJson(post("{no"))).rejects.toMatchObject({ status: 400, code: "bad_json" });
  });
});
