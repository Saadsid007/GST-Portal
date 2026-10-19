import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Migrations connect through DIRECT_URL when it is set. On Supabase the app
 * runs through the transaction pooler (port 6543), which cannot hold the
 * advisory lock `migrate deploy` takes, so the build migrates over the
 * session pooler (port 5432) instead. Without DIRECT_URL — Neon, local — the
 * one URL serves both.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"] || "",
  },
});
