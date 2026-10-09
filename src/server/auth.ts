import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "@/adapters/db/prisma";
import type { Mailer } from "@/adapters/mail/mailer";
import type { Env } from "@/config/env";

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
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: "Deck Doctor",
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
            sendResetPassword: async ({ user, url }) => {
              await mailer.send({
                to: user.email,
                subject: "Deck Doctor · Restablecer la contraseña",
                text: `Hola ${user.name},\n\nPara elegir una contraseña nueva abre este enlace (caduca en 1 hora):\n${url}\n\nSi no lo has pedido tú, ignora este mensaje.`,
              });
            },
          }
        : {}),
    },
    socialProviders: google,
    account: {
      // Si alguien se registró con email y luego entra con Google (mismo email verificado por
      // Google), es la misma cuenta.
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
