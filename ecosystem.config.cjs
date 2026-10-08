// Configuración de pm2 en el VPS. El puerto se puede cambiar con PORT en el entorno o aquí.
module.exports = {
  apps: [
    {
      name: "deck-doctor",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3010,
      },
      max_memory_restart: "512M",
    },
  ],
};
