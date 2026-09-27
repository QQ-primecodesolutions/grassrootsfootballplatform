import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groupAdminMatches } from "@/lib/admin/match-lists";
import type { Db } from "@/lib/db/client";
import {
  addTeamAlias,
  adminScopeForOrg,
  createTeam,
  getAdminMatch,
  insertFixtures,
  listAdminMatches,
  listCompetitionsForAdmin,
  listTeamsForAdmin,
  removeTeamAlias,
  saveMatchResult,
  updateTeam,
  type MatchResultPatch,
} from "@/lib/db/queries/admin";
import type { OrgScope } from "@/lib/db/queries";
import { matches, organisations } from "@/lib/db/schema";
import { buildResultPatch, resultFormSchema } from "@/lib/match/result-input";
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

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
  bp = await scopeFor("batho-pele");
  demo = await scopeFor("demo");
});
afterAll(async () => {
  await close();
});

describe("admin scope", () => {
  it("rejects unknown or malformed organisation ids from a session", async () => {
    expect(await adminScopeForOrg("not-a-uuid", db)).toBeNull();
    expect(await adminScopeForOrg("00000000-0000-4000-8000-000000000000", db)).toBeNull();
  });
});

describe("result entry (admin)", () => {
  it("confirms a result through the same rules the form uses", async () => {
    const all = await listAdminMatches(bp, db);
    const m = all.find((x) => x.home.name === "Remember Matoota FC")!;
    const input = resultFormSchema.parse({ matchId: m.id, intent: "confirm", status: "completed", homeGoals: "1", awayGoals: "0" });
    const built = buildResultPatch(input, { competitionType: m.competitionType, homeEntryId: m.homeEntryId, awayEntryId: m.awayEntryId });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const saved = await saveMatchResult(bp, m.id, { ...built.patch, confirmedAt: new Date() }, db);
    expect(saved?.competitionId).toBe(m.competitionId);
    const after = await getAdminMatch(bp, m.id, db);
    expect(after).toMatchObject({ homeGoals: 1, awayGoals: 0, resultState: "confirmed", winnerEntryId: m.homeEntryId });
  });

  it("cannot touch another organisation's match", async () => {
    const [demoMatch] = await listAdminMatches(demo, db);
    const patch: MatchResultPatch = {
      status: "completed",
      outcomeType: "normal",
      resultState: "provisional",
      homeGoals: 9,
      awayGoals: 9,
      htHomeGoals: null,
      htAwayGoals: null,
      aetHomeGoals: null,
      aetAwayGoals: null,
      penHome: null,
      penAway: null,
      winnerEntryId: null,
      confirmedAt: null,
      notes: null,
    };
    expect(await saveMatchResult(bp, demoMatch!.id, patch, db)).toBeNull();
    expect(await getAdminMatch(bp, demoMatch!.id, db)).toBeNull();
    const [unchanged] = await db.select().from(matches).where(eq(matches.id, demoMatch!.id));
    expect(unchanged!.homeGoals).not.toBe(9);
  });

  it("the database still refuses a confirmed result without a timestamp", async () => {
    const [m] = await listAdminMatches(bp, db);
    await expect(
      saveMatchResult(
        bp,
        m!.id,
        {
          status: "completed",
          outcomeType: "normal",
          resultState: "confirmed",
          homeGoals: 1,
          awayGoals: 1,
          htHomeGoals: null,
          htAwayGoals: null,
          aetHomeGoals: null,
          aetAwayGoals: null,
          penHome: null,
          penAway: null,
          winnerEntryId: null,
          confirmedAt: null,
          notes: null,
        },
        db,
      ),
    ).rejects.toThrow();
  });
});

describe("fixtures (admin)", () => {
  it("inserts pasted fixtures, skips duplicates, and learns aliases", async () => {
    const [streamA] = await listCompetitionsForAdmin(bp, db);
    const [a, b, c, d] = streamA!.entries;
    const kickoffAt = sastDateTime("2026-10-03", "14:00");
    const fixtures = [
      { homeEntryId: a!.entryId, awayEntryId: b!.entryId, kickoffAt, kickoffTimeTbc: false, venueId: null, roundLabel: "Round 8", roundNumber: 8 },
      { homeEntryId: c!.entryId, awayEntryId: d!.entryId, kickoffAt, kickoffTimeTbc: false, venueId: null, roundLabel: "Round 8", roundNumber: 8 },
    ];
    const first = await insertFixtures(bp, streamA!.id, fixtures, [{ teamId: a!.teamId, alias: "Some Nickname" }], db);
    expect(first).toMatchObject({ skipped: 0 });
    expect(first.inserted).toHaveLength(2);

    const again = await insertFixtures(bp, streamA!.id, fixtures, [], db);
    expect(again).toEqual({ inserted: [], skipped: 2 });

    const teams = await listTeamsForAdmin(bp, db);
    expect(teams.find((t) => t.id === a!.teamId)!.aliases.map((x) => x.alias)).toContain("Some Nickname");
  });

  it("refuses another organisation's competition or entries", async () => {
    const [streamA] = await listCompetitionsForAdmin(bp, db);
    const [demoLeague] = await listCompetitionsForAdmin(demo, db);
    const kickoffAt = sastDateTime("2026-10-10", "14:00");
    const demoEntries = demoLeague!.entries;
    await expect(
      insertFixtures(
        bp,
        demoLeague!.id,
        [{ homeEntryId: demoEntries[0]!.entryId, awayEntryId: demoEntries[1]!.entryId, kickoffAt, kickoffTimeTbc: false, venueId: null, roundLabel: null, roundNumber: null }],
        [],
        db,
      ),
    ).rejects.toThrow(/not found/);
    await expect(
      insertFixtures(
        bp,
        streamA!.id,
        [{ homeEntryId: demoEntries[0]!.entryId, awayEntryId: demoEntries[1]!.entryId, kickoffAt, kickoffTimeTbc: false, venueId: null, roundLabel: null, roundNumber: null }],
        [],
        db,
      ),
    ).rejects.toThrow();
  });
});

describe("teams (admin)", () => {
  it("creates teams with unique slugs and keeps the slug on rename", async () => {
    const input = { clubId: null, newClubName: "Passion", name: "Passion FC", shortName: "Passion", category: "U19", gender: null, logoUrl: null };
    const created = await createTeam(bp, input, db);
    expect(created.slug).toBe("passion-fc-u19"); // "passion-fc" is the Open team
    expect(await updateTeam(bp, created.id, { ...input, name: "Passion FC Juniors" }, db)).toBe(true);
    const teams = await listTeamsForAdmin(bp, db);
    expect(teams.find((t) => t.id === created.id)).toMatchObject({ name: "Passion FC Juniors", slug: "passion-fc-u19" });
  });

  it("scopes team edits and aliases to the organisation", async () => {
    const [demoTeam] = await listTeamsForAdmin(demo, db);
    const input = { clubId: null, newClubName: "X", name: "Hijack", shortName: "H", category: "Open", gender: null, logoUrl: null };
    expect(await updateTeam(bp, demoTeam!.id, input, db)).toBe(false);
    expect(await addTeamAlias(bp, demoTeam!.id, "Hijack", db)).toBe(false);
    const alias = demoTeam!.aliases[0]!;
    expect(await removeTeamAlias(bp, alias.id, db)).toBeNull();
    expect((await listTeamsForAdmin(demo, db))[0]!.aliases.map((a) => a.id)).toContain(alias.id);
  });
});

describe("admin match lists", () => {
  it("groups by SAST day: today, needs a result, upcoming, recently confirmed", async () => {
    const all = await listAdminMatches(demo, db);
    const g = groupAdminMatches(all, "2026-09-27");
    // Demo round 7 was 26 Sep: one provisional result still needs confirming.
    expect(g.needsResult.some((m) => m.resultState === "provisional" && m.status === "completed")).toBe(true);
    expect(g.needsResult.every((m) => m.status !== "postponed")).toBe(true);
    expect(g.upcoming.every((m) => m.kickoffAt! > sastDateTime("2026-09-27", "23:59"))).toBe(true);
    expect(g.recent.length).toBeGreaterThan(0);
    expect(g.recent.every((m) => m.resultState === "confirmed")).toBe(true);
  });
});
