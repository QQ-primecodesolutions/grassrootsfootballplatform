/**
 * pnpm db:seed [--overwrite-results] [--no-demo]
 *
 * --no-demo skips the fictional Demo org (use it for a real pilot's production database).
 * Idempotent: upserts reference data by natural keys and inserts matches keyed on
 * (competition, home, away, SAST date). Existing matches are left untouched unless
 * --overwrite-results is passed (use that to apply corrections to seed data files).
 */
import { createRequire } from "node:module";

// @next/env is CommonJS; load it via require so named exports resolve under ESM.
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());

const { createDb } = await import("@/lib/db/client");
const { getDbEnv } = await import("@/lib/env");
const { seedAll } = await import("./seed/index");

const overwriteResults = process.argv.includes("--overwrite-results");
const demo = !process.argv.includes("--no-demo");
const { db, close } = createDb(getDbEnv().DATABASE_URL);

try {
  const result = await seedAll(db, { overwriteResults, demo });
  for (const [org, r] of Object.entries(result)) {
    console.log(
      `${org}: matches inserted ${r.matchesInserted}, updated ${r.matchesUpdated}, unchanged ${r.matchesSkipped}`,
    );
  }
  console.log("Seed complete.");
} finally {
  await close();
}
