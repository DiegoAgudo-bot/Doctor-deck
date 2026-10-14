import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad en todas las respuestas: HTTPS siempre (HSTS), nadie nos mete en un
 * iframe (clickjacking), sin adivinar tipos de fichero y sin mandar la URL completa a otras webs.
 * La CSP solo restringe lo que no rompe Next (marcos, `<base>`, plugins).
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), screen-wake-lock=(self)",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Las URL antiguas (en español) llevan a las nuevas, para no romper enlaces guardados ni los
  // correos de "olvidé mi contraseña" ya enviados. La query (?token=, ?next=…) se conserva.
  async redirects() {
    return [
      ["/mazos/nuevo", "/decks/new"],
      ["/mazos", "/decks"],
      ["/mazo", "/analyze"],
      ["/coleccion", "/collection"],
      ["/comunidad", "/community"],
      ["/notificaciones", "/notifications"],
      ["/ajustes", "/settings"],
      ["/intercambios/con/:username", "/trades/with/:username"],
      ["/intercambios/propuestas/:id", "/trades/proposals/:id"],
      ["/intercambios", "/trades"],
      ["/entrar", "/login"],
      ["/registro", "/signup"],
      ["/recuperar", "/forgot-password"],
      ["/restablecer", "/reset-password"],
    ].map(([source, destination]) => ({
      source: source!,
      destination: destination!,
      permanent: true,
    }));
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
