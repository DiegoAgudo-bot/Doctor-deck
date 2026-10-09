import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/adapters/db/prisma";
import type { Mailer } from "@/adapters/mail/mailer";
import { loadEnv } from "@/config/env";
import { createTestDb } from "../../tests/helpers/test-db";
import { authFeatures, createAuth, type Auth } from "./auth";

let db: Db;
let cleanup: () => Promise<void>;
let auth: Auth;
const sent: { to: string; text: string }[] = [];
const mailer: Mailer = { send: async (m) => void sent.push(m) };
const env = loadEnv({ DATABASE_URL: "file:unused", HTTP_USER_AGENT: "test" });

beforeAll(() => {
  ({ db, cleanup } = createTestDb());
  auth = createAuth({ db, env, mailer });
});
afterAll(async () => cleanup());

/** Convierte los Set-Cookie de una respuesta en una cabecera Cookie. */
const cookieFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function signUp(email: string, password = "contraseña-segura") {
  return auth.api.signUpEmail({ body: { email, password, name: "Diego" }, asResponse: true });
}

describe("registro y login con email + contraseña", () => {
  it("al registrarse queda con sesión y la contraseña no se guarda en claro", async () => {
    const res = await signUp("diego@example.com");
    expect(res.ok).toBe(true);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieFrom(res) }),
    });
    expect(session?.user).toMatchObject({ email: "diego@example.com", name: "Diego" });

    const account = await db.account.findFirst({ where: { providerId: "credential" } });
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain("contraseña-segura");
  });

  it("no permite registrar dos veces el mismo email ni contraseñas cortas", async () => {
    expect((await signUp("diego@example.com")).ok).toBe(false);
    expect((await signUp("otro@example.com", "corta")).ok).toBe(false);
  });

  it("login correcto, contraseña mala y cierre de sesión", async () => {
    const ok = await auth.api.signInEmail({
      body: { email: "diego@example.com", password: "contraseña-segura" },
      asResponse: true,
    });
    expect(ok.ok).toBe(true);
    const headers = new Headers({ cookie: cookieFrom(ok) });
    expect((await auth.api.getSession({ headers }))?.user.email).toBe("diego@example.com");

    const bad = await auth.api.signInEmail({
      body: { email: "diego@example.com", password: "no-es-esta" },
      asResponse: true,
    });
    expect(bad.status).toBe(401);

    await auth.api.signOut({ headers });
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("sin cookie no hay sesión", async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  });
});

describe("restablecer contraseña", () => {
  it("envía un enlace por email y permite poner una contraseña nueva", async () => {
    await signUp("olvido@example.com", "antigua-123");
    await auth.api.requestPasswordReset({
      body: { email: "olvido@example.com", redirectTo: "/restablecer" },
    });
    const mail = sent.find((m) => m.to === "olvido@example.com");
    expect(mail?.text).toMatch(/\/api\/auth\/reset-password\//);
    const token = /reset-password\/([^?\s]+)/.exec(mail?.text ?? "")?.[1] ?? "";

    await auth.api.resetPassword({ body: { token, newPassword: "nueva-12345" } });
    const res = await auth.api.signInEmail({
      body: { email: "olvido@example.com", password: "nueva-12345" },
      asResponse: true,
    });
    expect(res.ok).toBe(true);
  });
});

describe("authFeatures", () => {
  it("Google y el reseteo solo se ofrecen si están configurados", () => {
    expect(authFeatures(env, null)).toEqual({ google: false, passwordReset: false });
    const withGoogle = loadEnv({
      DATABASE_URL: "x",
      HTTP_USER_AGENT: "t",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(authFeatures(withGoogle, mailer)).toEqual({ google: true, passwordReset: true });
  });
});
