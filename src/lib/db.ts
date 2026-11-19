import "server-only";
import { PrismaClient } from "@prisma/client";

// Budget connections per process: the CMS and storefront share one database.
// Explicit URL parameters override these defaults for larger deployments.
// Next.js imports route modules during builds without necessarily having runtime secrets.
const databaseUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : undefined;
for (const [key, value] of Object.entries({
  connection_limit: "3",
  pool_timeout: "20",
  connect_timeout: "10",
})) {
  if (databaseUrl && !databaseUrl.searchParams.has(key)) {
    databaseUrl.searchParams.set(key, value);
  }
}

const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ??
  (databaseUrl
    ? new PrismaClient({ datasourceUrl: databaseUrl.toString() })
    : new PrismaClient());
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
