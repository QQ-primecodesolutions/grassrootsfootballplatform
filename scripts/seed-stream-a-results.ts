/**
 * pnpm db:seed:stream-a-results [--allow-unverified] [--overwrite-results]
 *
 * Loads every Stream A result from tests/fixtures/stream-a-results.json into the
 * Batho Pele competition. Idempotent: matches already present (same competition,
 * home, away and SAST date) are skipped unless --overwrite-results.
 *
 * REAL ORGANISATION DATA: refuses to run while the fixture is marked
 * "unverified": true. Results marked "pending" are loaded as provisional (private, not counted)
 * and are confirmed or corrected later in /admin.
 */
import { createRequire } from "node:module";

const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());

const { createDb } = await import("@/lib/db/client");
const { getDbEnv } = await import("@/lib/env");
const { seedBathoPele } = await import("./seed/batho-pele");
const { newCounters } = await import("./seed/upsert");
const { STREAM_A_FIXTURE_PATH, fixtureToSeedResults, loadStreamAFixture } = await import("./seed/stream-a-fixture");

const allowUnverified = process.argv.includes("--allow-unverified");
const overwriteResults = process.argv.includes("--overwrite-results");

const fixture = loadStreamAFixture();
if (fixture.organisation !== "batho-pele") {
  throw new Error(`${STREAM_A_FIXTURE_PATH} is for "${fixture.organisation}", expected "batho-pele"`);
}
if (fixture.unverified && !allowUnverified) {
  console.error(
    `Refusing to load: ${STREAM_A_FIXTURE_PATH} is marked "unverified": true.\n` +
      `These are a real organisation's results. Once the organiser confirms them, set\n` +
      `"unverified" to false and run this again (or pass --allow-unverified for a test database).`,
  );
  process.exit(1);
}

const { db, close } = createDb(getDbEnv().DATABASE_URL);
try {
  const counters = newCounters();
  await db.transaction((tx) =>
    seedBathoPele(tx, { overwriteResults, counters, results: fixtureToSeedResults(fixture) }),
  );
  console.log(
    `Stream A: ${fixture.results.length} results in fixture — inserted ${counters.matchesInserted}, ` +
      `updated ${counters.matchesUpdated}, unchanged ${counters.matchesSkipped}.`,
  );
  const pendingCount = fixture.results.filter((r) => r.pending).length;
  if (pendingCount) {
    console.log(
      `${pendingCount} result(s) marked "pending" were loaded as provisional: they stay private and don't count until confirmed in /admin.`,
    );
  }
  if (fixture.unverified) console.warn("Warning: loaded UNVERIFIED results (--allow-unverified).");
} finally {
  await close();
}
