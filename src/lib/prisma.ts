import { PrismaPg } from "@prisma/adapter-pg";
// The explicit /client entrypoint, not the directory: the generated folder carries no
// package.json, so a bare directory import relies on index-file resolution that Turbopack's
// production build does not perform through a tsconfig alias — it builds on Windows and fails
// on Vercel with "Can't resolve '@/generated/prisma'".
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Small, because on Vercel every warm function instance holds its own pool
  // and the database's connection limit is shared by all of them. The
  // pooler in front of the database (Supabase's, on port 6543) multiplexes
  // these onto real connections.
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
