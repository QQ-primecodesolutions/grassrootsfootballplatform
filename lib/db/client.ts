import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import { getDbEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Driver choice (PLAN.md decision 6):
 * - localhost / 127.0.0.1 / ::1 → node-postgres (`pg`), for a Docker Postgres.
 * - anything else (Neon)        → Neon serverless WebSocket Pool, which supports
 *   interactive transactions. Node 22+ provides the global WebSocket it needs.
 * Both expose the same Drizzle API over the same schema.
 */

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDatabaseUrl(url: string): boolean {
  return LOCAL_HOSTS.has(new URL(url).hostname);
}

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  if (isLocalDatabaseUrl(url)) {
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    return { db: drizzlePg(pool, { schema }), close: () => pool.end() };
  }
  const pool = new NeonPool({ connectionString: url });
  return { db: drizzleNeon(pool, { schema }), close: () => pool.end() };
}

// Reuse one pool per process (and across dev hot reloads).
const globalForDb = globalThis as unknown as { __db?: Db };

export function getDb(): Db {
  globalForDb.__db ??= createDb(getDbEnv().DATABASE_URL).db;
  return globalForDb.__db;
}
