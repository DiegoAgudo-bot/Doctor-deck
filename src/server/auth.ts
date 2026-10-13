import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "@/adapters/db/prisma";
import type { Mailer } from "@/adapters/mail/mailer";
import type { Env } from "@/config/env";
import { reportServerError } from "./error-log";

/** Esquema de los enlaces de la app móvil (`doctordeck://…`): a donde vuelve el login con Google. */
export const APP_SCHEME = "doctordeck";

/** Solo para desarrollo: en producción `loadEnv` exige BETTER_AUTH_SECRET. */
const DEV_SECRET = "deck-doctor-dev-secret-not-for-production-use";

export interface AuthFeatures {
  google: boolean;
  passwordReset: boolean;
}

export const authFeatures = (env: Env, mailer: Mailer | null): AuthFeatures => ({
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  passwordReset: mailer !== null,
});

/**
 * Usuarios con Better Auth: email + contraseña (scrypt) y, si está configurado, Google.
 * Sesiones en BD (tabla `session`) con cookie httpOnly. Las rutas viven en /api/auth/*.
 */
export function createAuth({ db, env, mailer }: { db: Db; env: Env; mailer: Mailer | null }) {
  /**
   * Los correos se mandan sin esperar: la pantalla no se queda en "Enviando…" si el servidor de
   * correo tarda, y no se nota por el tiempo de respuesta si el email existe. Si falla, queda en
   * /admin/errors.
   */
  const sendInBackground = (message: Parameters<Mailer["send"]>[0], path: string) => {
    if (!mailer) return;
    void mailer.send(message).catch((err: unknown) => {
      console.error("No se pudo enviar un correo:", err);
      void reportServerError(err, path);
    });
  };
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: "Doctor Deck",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    database: prismaAdapter(db, { provider: "sqlite" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      ...(mailer
        ? {
            revokeSessionsOnPasswordReset: true,
            // Quien restablece la contraseña con el enlace del correo demuestra que el email es
            // suyo: queda verificado (y entrar con Google con ese email ya enlaza las cuentas).
            onPasswordReset: async ({ user }) => {
              if (!user.emailVerified) {
                await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
              }
            },
            sendResetPassword: async ({ user, url }) => {
              sendInBackground(
                {
                  to: user.email,
                  subject: "Doctor Deck · Restablecer la contraseña",
                  text: `Hola ${user.name},\n\nPara elegir una contraseña nueva abre este enlace (caduca en 1 hora):\n${url}\n\nSi no lo has pedido tú, ignora este mensaje.`,
                },
                "/api/auth/request-password-reset",
              );
            },
          }
        : {}),
    },
    // Con correo configurado, al registrarse llega un enlace para verificar el email. No es
    // obligatorio para entrar, pero sin verificar, Google no se enlaza solo (ver accountLinking).
    ...(mailer
      ? {
          emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({
              user,
              url,
            }: {
              user: { name: string; email: string };
              url: string;
            }) => {
              sendInBackground(
                {
                  to: user.email,
                  subject: "Doctor Deck · Confirma tu email",
                  text: `Hola ${user.name},\n\nConfirma que este email es tuyo abriendo este enlace:\n${url}\n\nSi no te has registrado en Doctor Deck, ignora este mensaje.`,
                },
                "/api/auth/send-verification-email",
              );
            },
          },
        }
      : {}),
    socialProviders: google,
    account: {
      // Si alguien se registró con email y luego entra con Google (mismo email), es la misma
      // cuenta, pero solo si su email ya está verificado (`requireLocalEmailVerified`, por
      // defecto): si no, alguien podría registrarse antes con un email ajeno y quedarse la cuenta
      // de quien luego entra con Google. Sin verificar, Google devuelve `account_not_linked`: se
      // explica en /login y se enlaza desde Ajustes, ya con sesión (`linkSocial`).
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    telemetry: { enabled: false },
    // La app móvil (Expo) manda la cookie de sesión en una cabecera y su origen en `expo-origin`;
    // el login con Google vuelve a `doctordeck://…` con la cookie en la URL (plugin `expo`).
    trustedOrigins: [`${APP_SCHEME}://`],
    plugins: [nextCookies(), expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
