import { AppError } from "@/application/errors";
import { getAuth } from "./container";

export class UnauthorizedError extends Error {
  constructor() {
    super("Tienes que iniciar sesión.");
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean | undefined;
  image?: string | null | undefined;
}

/** Usuario de la sesión (cookie) de la petición, o null. */
export async function currentUser(request: Request): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

/** Como `currentUser`, pero lanza UnauthorizedError (→ 401) si no hay sesión. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await currentUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Cuánto vale una sesión «reciente» para acciones delicadas sin contraseña (cuentas de Google). */
const FRESH_SESSION_MS = 15 * 60_000;

/**
 * Para acciones que no se deshacen (borrar la cuenta): con contraseña, hay que escribirla; si
 * solo se entra con Google, la sesión tiene que ser de hace menos de 15 minutos.
 */
export async function confirmIdentity(request: Request, password: string | undefined) {
  const auth = getAuth();
  const [session, accounts] = await Promise.all([
    auth.api.getSession({ headers: request.headers }),
    auth.api.listUserAccounts({ headers: request.headers }),
  ]);
  if (!session) throw new UnauthorizedError();
  if (accounts.some((a) => a.providerId === "credential")) {
    if (!password) throw new AppError("password_required", "Escribe tu contraseña para confirmar.");
    const ok = await auth.api
      .verifyPassword({ body: { password }, headers: request.headers })
      .then(() => true)
      .catch(() => false);
    if (!ok) throw new AppError("wrong_password", "La contraseña no es correcta.", 403);
    return;
  }
  if (Date.now() - new Date(session.session.createdAt).getTime() > FRESH_SESSION_MS) {
    throw new AppError(
      "stale_session",
      "Por seguridad, cierra sesión y vuelve a entrar antes de borrar la cuenta.",
      403,
    );
  }
}
