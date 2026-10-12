import { describe, expect, it } from "vitest";
import { createMailer, resendMailer } from "./mailer";

describe("mailer", () => {
  it("con el SMTP de Resend usa su API HTTPS con la clave como token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "1" }), { status: 200 });
    }) as unknown as typeof fetch;
    await resendMailer("re_abc", "Doctor Deck <noreply@doctordeck.app>", fake).send({
      to: "ana@example.com",
      subject: "Hola",
      text: "Texto",
    });
    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer re_abc");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      from: "Doctor Deck <noreply@doctordeck.app>",
      to: ["ana@example.com"],
      subject: "Hola",
      text: "Texto",
    });
  });

  it("si Resend lo rechaza, el error dice por qué", async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ message: "The doctordeck.app domain is not verified." }), {
        status: 403,
      })) as unknown as typeof fetch;
    await expect(
      resendMailer("re_abc", "x@doctordeck.app", fake).send({
        to: "a@b.c",
        subject: "s",
        text: "t",
      }),
    ).rejects.toThrow(/403.*not verified/);
  });

  it("elige Resend por el host y SMTP para el resto", () => {
    expect(createMailer("smtps://resend:re_abc@smtp.resend.com:465", "x@y.z")).toBeDefined();
    expect(createMailer("smtps://u:p@smtp.example.com:465", "x@y.z")).toBeDefined();
  });
});
