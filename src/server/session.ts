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
