import type { Db } from "@/lib/db/client";
import { seedBathoPele } from "./batho-pele";
import { seedDemo } from "./demo";
import { newCounters } from "./upsert";

export type SeedOptions = {
  overwriteResults?: boolean;
  /** Also seed the fictional Demo org (default true). Production pilots use --no-demo. */
  demo?: boolean;
};

/** Seed Batho Pele and (unless `demo: false`) the Demo org, each in its own transaction. Safe to re-run. */
export async function seedAll(db: Db, options: SeedOptions = {}) {
  const overwriteResults = options.overwriteResults ?? false;

  const bathoPeleCounters = newCounters();
  const bathoPele = await db.transaction((tx) =>
    seedBathoPele(tx, { overwriteResults, counters: bathoPeleCounters }),
  );

  let demo: (Awaited<ReturnType<typeof seedDemo>> & ReturnType<typeof newCounters>) | undefined;
  if (options.demo ?? true) {
    const demoCounters = newCounters();
    demo = { ...(await db.transaction((tx) => seedDemo(tx, { overwriteResults, counters: demoCounters }))), ...demoCounters };
  }
  return { bathoPele: { ...bathoPele, ...bathoPeleCounters }, ...(demo ? { demo } : {}) };
}
