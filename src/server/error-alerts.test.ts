import { describe, expect, it } from "vitest";
import type { ErrorLog } from "@/domain/ports/error-log";
import { withErrorAlerts } from "./error-alerts";

function fakeLog(): ErrorLog {
  const seen = new Set<string>();
  return {
    record: async (r) => {
      const isNew = !seen.has(r.message);
      seen.add(r.message);
      return isNew;
    },
    list: async () => [],
    clear: async () => {},
  };
}

describe("withErrorAlerts", () => {
  it("avisa a cada administrador solo la primera vez y como mucho 5 por hora", async () => {
    const mails: { to: string; subject: string }[] = [];
    let t = 0;
    const log = withErrorAlerts(fakeLog(), {
      mailer: { send: async (m) => void mails.push(m) },
      admins: ["a@x.es", "b@x.es"],
      siteUrl: "https://doctordeck.app",
      now: () => t,
    });
    expect(await log.record({ source: "server", message: "Boom", path: "/api/x" })).toBe(true);
    expect(await log.record({ source: "server", message: "Boom", path: "/api/x" })).toBe(false);
    expect(mails.map((m) => m.to)).toEqual(["a@x.es", "b@x.es"]);
    expect(mails[0]?.subject).toContain("Boom");

    for (let i = 0; i < 10; i++) await log.record({ source: "client", message: `E${i}` });
    expect(mails).toHaveLength(10); // 5 errores × 2 administradores
    t += 3_600_001;
    await log.record({ source: "client", message: "Otro" });
    expect(mails).toHaveLength(12);
  });

  it("sin correo o sin administradores es el registro tal cual", () => {
    const base = fakeLog();
    expect(withErrorAlerts(base, { mailer: null, admins: ["a@x.es"], siteUrl: "https://x" })).toBe(
      base,
    );
  });
});
