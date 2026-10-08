import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Mismo valor por defecto que .env.example, para que `prisma generate` funcione sin .env (CI).
    url: process.env["DATABASE_URL"] ?? "file:./data/deck-doctor.db",
  },
});
