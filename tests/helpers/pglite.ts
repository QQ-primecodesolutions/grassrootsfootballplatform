import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/**
 * In-memory Postgres (PGlite/WASM) with the real migrations applied.
 * Lets DB-level tests run without Docker or a Neon connection.
 */
export async function createTestDb(): Promise<{ db: Db; client: PGlite; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  return { db: db as unknown as Db, client, close: () => client.close() };
}
