import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/rules";
import { checkTableInvariants, compareWithPublishedTable, computeStandings, type StandingsMatch } from "@/lib/standings";
import { sastDateTime } from "@/lib/time";
import { STREAM_A_TEAMS } from "@/scripts/seed/data/batho-pele-stream-a";
import { STREAM_A_FIXTURE_PATH, loadStreamAFixture, type StreamAFixture } from "@/scripts/seed/stream-a-fixture";
import { PUBLISHED_TABLE_2026_08_15 } from "../fixtures/published-table-2026-08-15";

/**
 * Reconciliation: computing the table from the 21 real Stream A results must
 * reproduce the table Batho Pele published "as at 15 August 2026", cell for cell.
 * Round 5 Samba–Passion (3–0) is inferred and still awaits the organiser, so it's marked
 * "pending" in the fixture; this test checks that the inference reproduces their table.
 */

const entries = STREAM_A_TEAMS.map((t) => ({ entryId: t.name, name: t.name }));

function toMatches(fixture: StreamAFixture): StandingsMatch[] {
  return fixture.results.map((r, i) => ({
    id: `r${r.round}-${i}`,
    homeEntryId: r.home,
    awayEntryId: r.away,
    status: "completed",
    resultState: "confirmed",
    outcomeType: r.outcome ?? "normal",
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    winnerEntryId: null,
    kickoffAt: sastDateTime(r.date, r.time ?? "00:00"),
  }));
}

describe.skipIf(!existsSync(STREAM_A_FIXTURE_PATH))("Stream A reconciliation with the published 15 Aug 2026 table", () => {
  const fixture = loadStreamAFixture();

  it("has 21 results, each between two Stream A teams", () => {
    expect(fixture.results).toHaveLength(21);
    const names = new Set<string>(entries.map((e) => e.name));
    for (const r of fixture.results) {
      expect(names.has(r.home), r.home).toBe(true);
      expect(names.has(r.away), r.away).toBe(true);
    }
  });

  it("computes exactly the published table", () => {
    const rows = computeStandings(entries, toMatches(fixture), DEFAULT_RULES, [], { asOf: "2026-08-15" });
    expect(compareWithPublishedTable(rows, PUBLISHED_TABLE_2026_08_15)).toEqual([]);
    expect(checkTableInvariants(rows, DEFAULT_RULES)).toEqual({ ok: true, errors: [] });
  });

  it("records round 3 Lere La Tshepe v Tseki Junior Stars as an awarded 0–2", () => {
    const r3 = fixture.results.find((r) => r.round === 3 && r.home === "Lere La Tshepe FC");
    expect(r3).toMatchObject({ outcome: "awarded", homeGoals: 0, awayGoals: 2, notes: "Lere La Tshepe abandoned the match" });
  });

  it("documents why round 5 is 3–0: with Samba Boys 0–0 Passion the table would not match", () => {
    const alt: StreamAFixture = {
      ...fixture,
      results: fixture.results.map((r) =>
        r.round === 5 && r.home === "Samba Boys FC" ? { ...r, homeGoals: 0, awayGoals: 0 } : r,
      ),
    };
    const rows = computeStandings(entries, toMatches(alt), DEFAULT_RULES);
    const diffs = compareWithPublishedTable(rows, PUBLISHED_TABLE_2026_08_15);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs).toEqual(
      expect.arrayContaining([
        { team: "Samba Boys FC", column: "points", expected: 6, actual: 4 },
        { team: "Passion FC", column: "points", expected: 10, actual: 11 },
      ]),
    );
  });
});
