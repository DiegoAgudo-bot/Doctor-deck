import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FcmSender, parseServiceAccount } from "./fcm";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  project_id: "doctor-deck",
  client_email: "push@doctor-deck.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

describe("FcmSender", () => {
  it("pide el token OAuth una vez, manda cada mensaje y separa los tokens que ya no valen", async () => {
    const calls: string[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push(url);
      if (url.includes("oauth2")) {
        expect(String(init.body)).toContain("grant_type=urn");
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      const { message } = JSON.parse(String(init.body)) as { message: { token: string } };
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return message.token === "viejo"
        ? Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 })
        : Response.json({ name: "ok" });
    }) as unknown as typeof fetch;
    const sender = new FcmSender(account, fake);
    const msg = { title: "T", body: "B", data: { path: "/trades" } };
    const r = await sender.send([
      { token: "bueno", ...msg },
      { token: "viejo", ...msg },
    ]);
    expect(r.invalidTokens).toEqual(["viejo"]);
    await sender.send([{ token: "bueno", ...msg }]);
    expect(calls.filter((u) => u.includes("oauth2"))).toHaveLength(1);
    expect(calls.at(-1)).toBe("https://fcm.googleapis.com/v1/projects/doctor-deck/messages:send");
  });

  it("la cuenta de servicio vale en JSON o en base64", () => {
    const json = JSON.stringify(account);
    expect(parseServiceAccount(json).project_id).toBe("doctor-deck");
    expect(parseServiceAccount(Buffer.from(json).toString("base64")).client_email).toBe(
      account.client_email,
    );
  });
});
