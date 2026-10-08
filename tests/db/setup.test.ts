import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adjustmentSchema, competitionCreateSchema, competitionUpdateSchema } from "@/lib/competitions/input";
import type { Db } from "@/lib/db/client";
import type { OrgScope } from "@/lib/db/queries";
import { adminScopeForOrg, insertFixtures, listTeamsForAdmin } from "@/lib/db/queries/admin";
import {
  addEntries,
  addPointsAdjustment,
  createCompetition,
  createTeamsAndEnter,
  deleteCompetition,
  getCompetitionForSetup,
  listCompetitionsForSetup,
  removeEntry,
  removePointsAdjustment,
  updateCompetition,
  updateCompetitionRules,
} from "@/lib/db/queries/setup";
import { competitions, organisations } from "@/lib/db/schema";
import { DEFAULT_RULES } from "@/lib/rules";
import { sastDateTime } from "@/lib/time";
import { seedAll } from "@/scripts/seed/index";
import { createTestDb } from "../helpers/pglite";

let db: Db;
let close: () => Promise<void>;
let bp: OrgScope;
let demo: OrgScope;

async function scopeFor(slug: string) {
  const [org] = await db.select().from(organisations).where(eq(organisations.slug, slug));
  return (await adminScopeForOrg(org!.id, db))!.scope;
}

const form = (over: Record<string, string> = {}) =>
  competitionCreateSchema.parse({
    name: "Top 4 Cup",
    type: "knockout",
    season: "2026",
    slug: "top-4-cup-2026",
    ...over,
  });

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
  bp = await scopeFor("batho-pele");
  demo = await scopeFor("demo");
});
afterAll(async () => {
  await close();
});

describe("competition setup", () => {
  let cupId: string;

  it("creates a competition in an existing season with default, unconfirmed rules", async () => {
    const created = await createCompetition(bp, form(), db);
    expect(created.ok).toBe(true);
    cupId = (created as { id: string }).id;
    const data = await getCompetitionForSetup(bp, cupId, db);
    expect(data?.competition).toMatchObject({ type: "knockout", seasonName: "2026", isFeatured: false, expectedMatchCount: null });
    expect(data?.competition.rules).toEqual(DEFAULT_RULES);
    expect(DEFAULT_RULES.confirmed).toBe(false);
  });

  it("refuses a link name already used in the same organisation, but allows it in another", async () => {
    expect(await createCompetition(bp, form(), db)).toEqual({ ok: false, error: "slug-taken" });
    expect((await createCompetition(demo, form(), db)).ok).toBe(true);
  });

  it("can't be read or changed from another organisation", async () => {
    expect(await getCompetitionForSetup(demo, cupId, db)).toBeNull();
    const update = competitionUpdateSchema.parse({ name: "Hijacked" });
    expect(await updateCompetition(demo, cupId, update, db)).toBe(false);
    expect(await updateCompetitionRules(demo, cupId, DEFAULT_RULES, db)).toBe(false);
    expect(await addEntries(demo, cupId, [], db)).toEqual([]);
    expect(await createTeamsAndEnter(demo, cupId, ["X FC"], "Open", db)).toBeNull();
    expect(await deleteCompetition(demo, cupId, db)).toBe("not-found");
  });

  it("featuring one competition un-features the others", async () => {
    const update = competitionUpdateSchema.parse({ name: "Top 4 Cup", isFeatured: "on" });
    expect(await updateCompetition(bp, cupId, update, db)).toBe(true);
    const list = await listCompetitionsForSetup(bp, db);
    expect(list.filter((c) => c.isFeatured).map((c) => c.id)).toEqual([cupId]);
    await updateCompetition(bp, cupId, competitionUpdateSchema.parse({ name: "Top 4 Cup" }), db);
    await db.update(competitions).set({ isFeatured: true }).where(eq(competitions.slug, "qdl-open-stream-a-2026"));
  });

  it("enters existing teams and pasted new ones, reusing teams with the same name", async () => {
    const bpTeams = await listTeamsForAdmin(bp, db);
    const passion = bpTeams.find((t) => t.name === "Passion FC")!;
    const demoTeams = await listTeamsForAdmin(demo, db);
    // A team from another organisation is ignored.
    expect(await addEntries(bp, cupId, [passion.id, demoTeams[0]!.id], db)).toEqual([passion.id]);
    expect(await addEntries(bp, cupId, [passion.id], db)).toEqual([]);

    const result = await createTeamsAndEnter(bp, cupId, ["samba boys fc", "Mabolela United", "Mabolela United"], "Open", db);
    expect(result).toEqual({ created: 1, reused: 1 });
    const data = await getCompetitionForSetup(bp, cupId, db);
    expect(data?.entries.map((e) => e.name).sort()).toEqual(["Mabolela United", "Passion FC", "Samba Boys FC"]);
  });

  it("removes a team only before it has matches here", async () => {
    const data = (await getCompetitionForSetup(bp, cupId, db))!;
    const [a, b, c] = data.entries;
    await insertFixtures(
      bp,
      cupId,
      [
        {
          homeEntryId: a!.entryId,
          awayEntryId: b!.entryId,
          kickoffAt: sastDateTime("2026-10-12", "10:00"),
          kickoffTimeTbc: false,
          venueId: null,
          roundLabel: "Semi-final",
          roundNumber: null,
        },
      ],
      [],
      db,
    );
    expect((await removeEntry(bp, cupId, a!.entryId, db)).result).toBe("has-matches");
    expect(await removeEntry(demo, cupId, c!.entryId, db)).toEqual({ result: "not-found" });
    expect(await removeEntry(bp, cupId, c!.entryId, db)).toEqual({ result: "removed", teamId: c!.teamId });
    expect(await deleteCompetition(bp, cupId, db)).toBe("has-matches");
  });

  it("deletes an empty competition with its entries", async () => {
    const created = await createCompetition(bp, form({ slug: "mistake", type: "league" }), db);
    const id = (created as { id: string }).id;
    await createTeamsAndEnter(bp, id, ["Passion FC"], "Open", db);
    expect(await deleteCompetition(bp, id, db)).toBe("deleted");
    expect(await getCompetitionForSetup(bp, id, db)).toBeNull();
  });
});

describe("rules and adjustments", () => {
  it("saves confirmed rules and records points adjustments, scoped to the organisation", async () => {
    const [streamA] = await db.select().from(competitions).where(eq(competitions.slug, "qdl-open-stream-a-2026"));
    const rules = { ...DEFAULT_RULES, tieBreakers: ["points", "headToHead", "goalDifference"] as typeof DEFAULT_RULES.tieBreakers, confirmed: true };
    expect(await updateCompetitionRules(bp, streamA!.id, rules, db)).toBe(true);
    const data = (await getCompetitionForSetup(bp, streamA!.id, db))!;
    expect(data.competition.rules).toEqual(rules);

    const entry = data.entries[0]!;
    const input = adjustmentSchema.parse({ entryId: entry.entryId, points: "-3", reason: "Ineligible player", effectiveOn: "2026-08-01" });
    expect(await addPointsAdjustment(bp, streamA!.id, input, db)).toBe("added");
    expect(await addPointsAdjustment(bp, streamA!.id, input, db)).toBe("duplicate");
    expect(await addPointsAdjustment(demo, streamA!.id, input, db)).toBe("not-found");

    const [adj] = (await getCompetitionForSetup(bp, streamA!.id, db))!.adjustments;
    expect(adj).toMatchObject({ teamName: entry.name, points: -3 });
    expect(await removePointsAdjustment(demo, streamA!.id, adj!.id, db)).toBe(false);
    expect(await removePointsAdjustment(bp, streamA!.id, adj!.id, db)).toBe(true);
  });

  it("re-running the seed keeps admin-edited settings and rules", async () => {
    await db.update(competitions).set({ name: "Renamed by admin" }).where(eq(competitions.slug, "qdl-open-stream-a-2026"));
    await seedAll(db);
    const [streamA] = await db.select().from(competitions).where(eq(competitions.slug, "qdl-open-stream-a-2026"));
    expect(streamA).toMatchObject({ name: "Renamed by admin", logoUrl: "/brand/qdl.png" });
    expect(streamA!.rules.confirmed).toBe(true);
  });
});

describe("friendlies", () => {
  it("creates a friendlies competition and keeps level results without a winner", async () => {
    const created = await createCompetition(bp, form({ name: "Friendlies", type: "friendly", slug: "friendlies-2026" }), db);
    expect(created.ok).toBe(true);
    const id = (created as { id: string }).id;
    expect(await createTeamsAndEnter(bp, id, ["Passion FC", "Mabolela United"], "Open", db)).toEqual({ created: 0, reused: 2 });
    const data = (await getCompetitionForSetup(bp, id, db))!;
    expect(data.competition).toMatchObject({ type: "friendly", expectedMatchCount: null });
    expect(data.entries).toHaveLength(2);
  });
});
