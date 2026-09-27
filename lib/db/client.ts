import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import { getDbEnv } from "@/lib/env";
import * as schema from "./schema";
import { withVerifiedTls } from "./url";

/**
 * One driver everywhere: node-postgres (`pg`) over TCP, for Neon and for a local Docker
 * Postgres alike. This follows Neon's guidance for Vercel Functions with Fluid compute
 * (https://neon.com/docs/guides/vercel-connection-methods): warm instances reuse one pool,
 * and `attachDatabasePool` releases idle connections before Vercel suspends the function.
 * Outside Vercel, `attachDatabasePool` does nothing.
 */

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export function createDb(url: string): { db: Db; pool: pg.Pool; close: () => Promise<void> } {
  const pool = new pg.Pool({ connectionString: withVerifiedTls(url), idleTimeoutMillis: 5_000 });
  // An idle client can drop (network blip, database restart). Without a listener, pg's
  // "error" event would crash the process; the pool discards the client and reconnects.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return { db: drizzle(pool, { schema }), pool, close: () => pool.end() };
}

// Reuse one pool per process (and across dev hot reloads).
const globalForDb = globalThis as unknown as { __db?: Db };

export function getDb(): Db {
  if (!globalForDb.__db) {
    const { db, pool } = createDb(getDbEnv().DATABASE_URL);
    attachDatabasePool(pool);
    globalForDb.__db = db;
  }
  return globalForDb.__db;
}
