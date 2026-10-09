import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/container";

// Todas las rutas de Better Auth: /api/auth/sign-in/email, /sign-up/email, /sign-in/social,
// /callback/google, /sign-out, /get-session, /request-password-reset, /reset-password…
export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));
