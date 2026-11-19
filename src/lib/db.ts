import "server-only";
import { PrismaClient } from "@prisma/client";

// Budget connections per process: the CMS and storefront share one database.
// Explicit URL parameters override these defaults for larger deployments.
const databaseUrl = new URL(process.env.DATABASE_URL!);
for (const [key, value] of Object.entries({
  connection_limit: "3",
  pool_timeout: "20",
  connect_timeout: "10",
})) {
  if (!databaseUrl.searchParams.has(key)) databaseUrl.searchParams.set(key, value);
}

const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl.toString() });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
