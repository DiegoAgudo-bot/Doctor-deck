import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El antiguo login de contraseña única vivía en /login.
  async redirects() {
    return [{ source: "/login", destination: "/entrar", permanent: false }];
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
