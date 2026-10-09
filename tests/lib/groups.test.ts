import { describe, expect, it } from "vitest";
import { parseGroupForm } from "@/lib/competitions/input";
import { buildResultPatch, resultFormSchema, resultRulesFor } from "@/lib/match/result-input";
import { toPublicResult, type PublicMatch, type PublicTeamRef } from "@/lib/match/public";
import { groupTables, knockoutMatches, stageProblem } from "@/lib/public/groups";
import { DEFAULT_RULES } from "@/lib/rules";
import { sastDateTime } from "@/lib/time";

const team = (id: string, group: string | null): PublicTeamRef => ({
  entryId: id,
  teamId: `t-${id}`,
  name: `Team ${id.toUpperCase()}`,
  shortName: id.toUpperCase(),
  slug: id,
  logoUrl: null,
  groupLabel: group,
});

const teams = { a: team("a", "A"), b: team("b", "A"), c: team("c", "B"), d: team("d", "B") };

let n = 0;
function match(home: PublicTeamRef, away: PublicTeamRef, hg: number, ag: number, stage: "group" | "knockout", confirmed = true): PublicMatch {
  n++;
  return {
    id: `m${n}`,
    competition: { id: "c", slug: "cup", name: "Cup", streamLabel: null, area: null, type: "group_knockout" },
    roundLabel: stage === "knockout" ? "Final" : null,
    roundNumber: null,
    stage,
    kickoffAt: sastDateTime(`2026-10-${String(10 + n).padStart(2, "0")}`, "10:00"),
    kickoffTimeTbc: false,
    status: "completed",
    resultState: confirmed ? "confirmed" : "provisional",
    outcomeType: "normal",
    home,
    away,
    venue: null,
    notes: null,
    result: toPublicResult({
      status: "completed",
      resultState: confirmed ? "confirmed" : "provisional",
      outcomeType: "normal",
      homeGoals: hg,
      awayGoals: ag,
      htHomeGoals: null,
      htAwayGoals: null,
      aetHomeGoals: null,
      aetAwayGoals: null,
      penHome: null,
      penAway: null,
      winnerEntryId: hg > ag ? home.entryId : hg < ag ? away.entryId : null,
    }),
  };
}

describe("group tables", () => {
  const matches = [
    match(teams.a, teams.b, 2, 0, "group"),
    match(teams.c, teams.d, 1, 1, "group"),
    match(teams.d, teams.c, 3, 0, "group", false), // provisional: doesn't count
    match(teams.a, teams.c, 5, 0, "knockout"), // knockout: not in any group table
  ];
  const data = { entries: Object.values(teams), matches, adjustments: [], competition: { rules: DEFAULT_RULES } };

  it("computes one table per group from confirmed group matches only", () => {
    const tables = groupTables(data);
    expect(tables.map((t) => t.label)).toEqual(["A", "B"]);
    expect(tables[0]!.rows.map((r) => [r.team.entryId, r.points, r.goalsFor])).toEqual([
      ["a", 3, 2],
      ["b", 0, 0],
    ]);
    expect(tables[1]!.rows.map((r) => [r.team.entryId, r.points])).toEqual([
      ["c", 1],
      ["d", 1],
    ]);
  });

  it("leaves teams without a group out of the tables, and lists knockout matches separately", () => {
    const tables = groupTables({ ...data, entries: [...Object.values(teams), team("e", null)] });
    expect(tables.flatMap((t) => t.rows.map((r) => r.team.entryId))).not.toContain("e");
    expect(knockoutMatches(matches).map((m) => m.roundLabel)).toEqual(["Final"]);
  });
});

describe("stages", () => {
  it("checks group fixtures are within one group", () => {
    expect(stageProblem("group", "A", "A")).toBeNull();
    expect(stageProblem("group", "A", "B")).toMatch(/same group/);
    expect(stageProblem("group", null, "A")).toMatch(/group first/);
    expect(stageProblem("knockout", "A", "B")).toBeNull();
    expect(stageProblem(null, null, null)).toBeNull();
  });

  it("applies league rules to group matches and knockout rules to knockout matches", () => {
    expect(resultRulesFor("group_knockout", "group")).toEqual({ extrasAllowed: false, winnerRequired: false });
    expect(resultRulesFor("group_knockout", "knockout")).toEqual({ extrasAllowed: true, winnerRequired: true });
    const form = resultFormSchema.parse({ matchId: "3f2c1c9e-1111-4222-8333-944455556666", intent: "confirm", status: "completed", homeGoals: "1", awayGoals: "1" });
    const ctx = { competitionType: "group_knockout" as const, homeEntryId: "H", awayEntryId: "A" };
    expect(buildResultPatch(form, { ...ctx, stage: "group" }).ok).toBe(true);
    expect(buildResultPatch(form, { ...ctx, stage: "knockout" }).ok).toBe(false);
  });

  it("reads the Groups form", () => {
    const id1 = "5d1e8a2b-7f3c-4b6d-8e9f-0a1b2c3d4e5f";
    const id2 = "0b6f2a5e-1c1d-4c3e-9a77-2f7d1b9c0a11";
    expect(
      parseGroupForm([
        ["competitionId", "x"],
        [`group:${id1}`, "b"],
        [`group:${id2}`, ""],
        ["group:not-an-id", "A"],
      ]),
    ).toEqual([
      { entryId: id1, groupLabel: "B" },
      { entryId: id2, groupLabel: null },
    ]);
  });
});
