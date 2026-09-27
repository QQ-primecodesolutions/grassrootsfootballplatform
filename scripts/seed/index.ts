import type { Db } from "@/lib/db/client";
import { seedBathoPele } from "./batho-pele";
import { seedDemo } from "./demo";
import { newCounters } from "./upsert";

export type SeedOptions = { overwriteResults?: boolean };

/** Seed both organisations, each in its own transaction. Safe to re-run. */
export async function seedAll(db: Db, options: SeedOptions = {}) {
  const overwriteResults = options.overwriteResults ?? false;

  const bathoPeleCounters = newCounters();
  const bathoPele = await db.transaction((tx) =>
    seedBathoPele(tx, { overwriteResults, counters: bathoPeleCounters }),
  );

  const demoCounters = newCounters();
  const demo = await db.transaction((tx) => seedDemo(tx, { overwriteResults, counters: demoCounters }));

  return {
    bathoPele: { ...bathoPele, ...bathoPeleCounters },
    demo: { ...demo, ...demoCounters },
  };
}
