import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
