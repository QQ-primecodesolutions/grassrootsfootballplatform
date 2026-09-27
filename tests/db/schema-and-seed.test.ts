import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  clubs,
  competitionEntries,
  competitions,
  competitionSponsors,
  matches,
  organisations,
  pointsAdjustments,
  teamAliases,
  teams,
} from "@/lib/db/schema";
import { BATHO_PELE_SLUG, STREAM_A_SLUG, seedBathoPele } from "@/scripts/seed/batho-pele";
import { DEMO_CUP_SLUG, DEMO_LEAGUE_SLUG, DEMO_SLUG } from "@/scripts/seed/demo";
import { seedAll } from "@/scripts/seed/index";
import { fixtureToSeedResults, loadStreamAFixture } from "@/scripts/seed/stream-a-fixture";
import { newCounters } from "@/scripts/seed/upsert";
import { createTestDb } from "../helpers/pglite";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

async function count(table: PgTable, where?: SQL) {
  const q = db.select({ n: sql<number>`count(*)::int` }).from(table);
  const rows = await (where ? q.where(where) : q);
  return rows[0]!.n;
}

async function competitionId(slug: string) {
  const [row] = await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.slug, slug));
  return row!.id;
}

describe("seed", () => {
  it("creates both organisations with the expected data", async () => {
    const first = await seedAll(db);
    expect(first.bathoPele.matchesInserted).toBe(3);
    expect(first.demo!.matchesInserted).toBe(56 + 3);

    const orgs = await db.select().from(organisations).orderBy(organisations.slug);
    expect(orgs.map((o) => o.slug)).toEqual([BATHO_PELE_SLUG, DEMO_SLUG]);
    const bp = orgs[0]!;
    expect(bp.name).toBe("Batho Pele Kasi Soccer Tournament");
    expect(bp.tagline).toBe("ONE GAME. ONE PASSION. ONE LEAGUE.");
    expect(bp.hashtags).toEqual(["#ITSTIMETOSHINE", "#QDL", "#BathoPeleKasiSoccerTournament"]);

    expect(await count(teams, eq(teams.organisationId, bp.id))).toBe(6);
    expect(await count(clubs, eq(clubs.organisationId, bp.id))).toBe(6);
    expect(await count(teamAliases, eq(teamAliases.organisationId, bp.id))).toBe(7);

    const streamA = await competitionId(STREAM_A_SLUG);
    expect(await count(competitionEntries, eq(competitionEntries.competitionId, streamA))).toBe(6);
    expect(await count(competitionSponsors, eq(competitionSponsors.competitionId, streamA))).toBe(4);

    // Only the three known 15 Aug results; all confirmed, stored with the SAST date.
    const bpMatches = await db.select().from(matches).where(eq(matches.competitionId, streamA));
    expect(bpMatches).toHaveLength(3);
    for (const m of bpMatches) {
      expect(m.status).toBe("completed");
      expect(m.resultState).toBe("confirmed");
      expect(m.kickoffDate).toBe("2026-08-15");
      expect(m.kickoffTimeTbc).toBe(true);
    }
  });

  it("is idempotent: a second run inserts nothing", async () => {
    const before = await count(matches);
    const second = await seedAll(db);
    expect(second.bathoPele).toMatchObject({ matchesInserted: 0, matchesSkipped: 3 });
    expect(second.demo).toMatchObject({ matchesInserted: 0, matchesSkipped: 59 });
    expect(await count(matches)).toBe(before);
    expect(await count(organisations)).toBe(2);
    expect(await count(teamAliases)).toBe(7 + 9);
    expect(await count(pointsAdjustments)).toBe(1);
  });

  it("does not clobber admin edits unless --overwrite-results", async () => {
    const streamA = await competitionId(STREAM_A_SLUG);
    const [m] = await db.select().from(matches).where(eq(matches.competitionId, streamA)).limit(1);
    await db.update(matches).set({ notes: "edited in admin" }).where(eq(matches.id, m!.id));

    await seedAll(db);
    const [kept] = await db.select().from(matches).where(eq(matches.id, m!.id));
    expect(kept!.notes).toBe("edited in admin");

    const overwritten = await seedAll(db, { overwriteResults: true });
    expect(overwritten.bathoPele).toMatchObject({ matchesInserted: 0, matchesUpdated: 3 });
    const [reset] = await db.select().from(matches).where(eq(matches.id, m!.id));
    expect(reset!.notes).toBeNull();
    expect(await count(matches, eq(matches.competitionId, streamA))).toBe(3);
  });

  it("seeds the demo mix of states", async () => {
    const league = await competitionId(DEMO_LEAGUE_SLUG);
    const rows = await db
      .select({ status: matches.status, state: matches.resultState, outcome: matches.outcomeType })
      .from(matches)
      .where(eq(matches.competitionId, league));
    const tally = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).length;
    expect(tally((r) => r.status === "completed" && r.state === "confirmed")).toBe(6 * 4 + 2);
    expect(tally((r) => r.status === "completed" && r.state === "provisional")).toBe(1);
    expect(tally((r) => r.status === "postponed")).toBe(1);
    expect(tally((r) => r.outcome === "walkover")).toBe(1);
    expect(tally((r) => r.status === "scheduled")).toBe(7 * 4);

    const cup = await competitionId(DEMO_CUP_SLUG);
    const shootouts = await db
      .select()
      .from(matches)
      .where(and(eq(matches.competitionId, cup), sql`${matches.penHome} IS NOT NULL`));
    expect(shootouts).toHaveLength(1);
    expect(shootouts[0]!.winnerEntryId).toBe(shootouts[0]!.awayEntryId);
  });
});

/** Assert a write fails because of a specific constraint (not some unrelated error). */
async function expectViolation(write: PromiseLike<unknown>, constraint: string) {
  const error = await Promise.resolve(write).then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${constraint} to be violated`).not.toBeNull();
  const e = error as { message?: string; cause?: { message?: string; constraint?: string } };
  const text = [e.message, e.cause?.message, e.cause?.constraint].join(" ");
  expect(text).toContain(constraint);
}

describe("seed --no-demo (production pilots)", () => {
  it("creates only the real organisation", async () => {
    const fresh = await createTestDb();
    try {
      const result = await seedAll(fresh.db, { demo: false });
      expect(result.demo).toBeUndefined();
      const orgs = await fresh.db.select({ slug: organisations.slug }).from(organisations);
      expect(orgs.map((o) => o.slug)).toEqual([BATHO_PELE_SLUG]);
    } finally {
      await fresh.close();
    }
  });
});

describe("loading the full Stream A fixture (pnpm db:seed:stream-a-results)", () => {
  it("adds the 18 missing results, skips the 3 already seeded, and is idempotent", async () => {
    const results = fixtureToSeedResults(loadStreamAFixture());
    const first = newCounters();
    await db.transaction((tx) => seedBathoPele(tx, { overwriteResults: false, counters: first, results }));
    expect(first).toEqual({ matchesInserted: 18, matchesUpdated: 0, matchesSkipped: 3 });

    const again = newCounters();
    await db.transaction((tx) => seedBathoPele(tx, { overwriteResults: false, counters: again, results }));
    expect(again).toEqual({ matchesInserted: 0, matchesUpdated: 0, matchesSkipped: 21 });

    const streamA = await competitionId(STREAM_A_SLUG);
    expect(await count(matches, eq(matches.competitionId, streamA))).toBe(21);

    const [awarded] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.competitionId, streamA), eq(matches.outcomeType, "awarded")));
    expect(awarded).toMatchObject({
      kickoffDate: "2026-07-04",
      homeGoals: 0,
      awayGoals: 2,
      status: "completed",
      notes: "Lere La Tshepe abandoned the match",
    });
    expect(awarded!.winnerEntryId).toBe(awarded!.awayEntryId);
  });
});

describe("database constraints", () => {
  async function ctx() {
    const league = await competitionId(DEMO_LEAGUE_SLUG);
    const cup = await competitionId(DEMO_CUP_SLUG);
    const [org] = await db.select().from(organisations).where(eq(organisations.slug, DEMO_SLUG));
    const entries = await db
      .select({ id: competitionEntries.id })
      .from(competitionEntries)
      .where(eq(competitionEntries.competitionId, league));
    const cupEntries = await db
      .select({ id: competitionEntries.id })
      .from(competitionEntries)
      .where(eq(competitionEntries.competitionId, cup));
    return { orgId: org!.id, league, entries: entries.map((e) => e.id), cupEntries: cupEntries.map((e) => e.id) };
  }

  const kickoffAt = new Date("2026-12-05T12:00:00Z");

  it("rejects a team playing itself", async () => {
    const c = await ctx();
    await expectViolation(
      db.insert(matches).values({
        organisationId: c.orgId,
        competitionId: c.league,
        homeEntryId: c.entries[0]!,
        awayEntryId: c.entries[0]!,
        kickoffAt,
      }), "matches_home_ne_away");
  });

  it("rejects an entry from a different competition", async () => {
    const c = await ctx();
    await expectViolation(
      db.insert(matches).values({
        organisationId: c.orgId,
        competitionId: c.league,
        homeEntryId: c.entries[0]!,
        awayEntryId: c.cupEntries[1]!,
        kickoffAt,
      }), "matches_away_entry_fk");
  });

  it("rejects cross-organisation references", async () => {
    const [bp] = await db.select().from(organisations).where(eq(organisations.slug, BATHO_PELE_SLUG));
    const [demoClub] = await db
      .select()
      .from(clubs)
      .innerJoin(organisations, eq(clubs.organisationId, organisations.id))
      .where(eq(organisations.slug, DEMO_SLUG))
      .limit(1);
    await expectViolation(
      db.insert(teams).values({
        organisationId: bp!.id,
        clubId: demoClub!.clubs.id,
        name: "Sneaky FC",
        shortName: "Sneaky",
        slug: "sneaky-fc",
        category: "Open",
      }), "teams_club_fk");
  });

  it("rejects a walkover that is not completed", async () => {
    const c = await ctx();
    await expectViolation(
      db.insert(matches).values({
        organisationId: c.orgId,
        competitionId: c.league,
        homeEntryId: c.entries[0]!,
        awayEntryId: c.entries[1]!,
        kickoffAt,
        status: "scheduled",
        outcomeType: "walkover",
        winnerEntryId: c.entries[0]!,
      }), "matches_walkover_shape");
  });

  it("rejects penalties when the match was not drawn", async () => {
    const c = await ctx();
    await expectViolation(
      db.insert(matches).values({
        organisationId: c.orgId,
        competitionId: c.league,
        homeEntryId: c.entries[0]!,
        awayEntryId: c.entries[1]!,
        kickoffAt,
        status: "completed",
        homeGoals: 2,
        awayGoals: 1,
        penHome: 4,
        penAway: 3,
      }), "matches_pens_only_when_level");
  });

  it("rejects negative scores and a completed match without a score", async () => {
    const c = await ctx();
    const base = {
      organisationId: c.orgId,
      competitionId: c.league,
      homeEntryId: c.entries[2]!,
      awayEntryId: c.entries[3]!,
      kickoffAt,
    };
    await expectViolation(db.insert(matches).values({ ...base, homeGoals: -1, awayGoals: 0 }), "matches_scores_non_negative");
    await expectViolation(db.insert(matches).values({ ...base, status: "completed" }), "matches_completed_has_score");
  });

  it("rejects a confirmed result without confirmed_at", async () => {
    const c = await ctx();
    await expectViolation(
      db.insert(matches).values({
        organisationId: c.orgId,
        competitionId: c.league,
        homeEntryId: c.entries[4]!,
        awayEntryId: c.entries[5]!,
        kickoffAt,
        status: "completed",
        homeGoals: 1,
        awayGoals: 0,
        resultState: "confirmed",
      }), "matches_confirmed_has_timestamp");
  });
});
