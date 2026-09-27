import { describe, expect, it } from "vitest";
import { tagsForMatchChange } from "@/lib/cache/tags";
import {
  competitionSubtitle,
  displayState,
  formatKickoff,
  mainScore,
  scoreDetails,
  toPublicResult,
  toStandingsMatch,
  type PublicMatch,
} from "@/lib/match/public";
import { contrastRatio, readableTextOn } from "@/lib/public/color";
import { fixturesOf, groupByDate, groupByRound, resultsOf, standingsFor, upcomingOf } from "@/lib/public/views";
import { DEFAULT_RULES } from "@/lib/rules";
import { sastDateTime } from "@/lib/time";

const raw = {
  status: "completed" as const,
  resultState: "confirmed" as const,
  outcomeType: "normal" as const,
  homeGoals: 2,
  awayGoals: 1,
  htHomeGoals: 1,
  htAwayGoals: 0,
  aetHomeGoals: null,
  aetAwayGoals: null,
  penHome: null,
  penAway: null,
  winnerEntryId: "h",
};

describe("public results never leak unconfirmed scores", () => {
  it("returns a result only for completed + confirmed matches", () => {
    expect(toPublicResult(raw)).toMatchObject({ fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } });
    expect(toPublicResult({ ...raw, resultState: "provisional" })).toBeNull();
    expect(toPublicResult({ ...raw, status: "abandoned" })).toBeNull();
    expect(toPublicResult({ ...raw, status: "postponed" })).toBeNull();
  });

  it("formats scores, extra time, penalties and walkovers", () => {
    expect(mainScore(toPublicResult(raw))).toBe("2–1");
    expect(mainScore(null)).toBeNull();
    const shootout = toPublicResult({
      ...raw,
      homeGoals: 1,
      awayGoals: 1,
      aetHomeGoals: 2,
      aetAwayGoals: 2,
      penHome: 4,
      penAway: 5,
      winnerEntryId: "a",
    });
    expect(mainScore(shootout)).toBe("2–2");
    expect(scoreDetails(shootout)).toEqual(["After extra time (90′: 1–1)", "Penalties 4–5", "HT 1–0"]);
    const walkover = toPublicResult({ ...raw, outcomeType: "walkover", homeGoals: null, awayGoals: null, htHomeGoals: null, htAwayGoals: null });
    expect(mainScore(walkover)).toBe("W/O");
    expect(scoreDetails(walkover)).toEqual(["Walkover"]);
    expect(scoreDetails(toPublicResult({ ...raw, outcomeType: "awarded", htHomeGoals: null, htAwayGoals: null }))).toEqual(["Awarded"]);
  });

  it("labels display states", () => {
    expect(displayState({ status: "completed", resultState: "confirmed" })).toBe("final");
    expect(displayState({ status: "completed", resultState: "provisional" })).toBe("pending");
    expect(displayState({ status: "postponed", resultState: "provisional" })).toBe("postponed");
  });
});

let n = 0;
function match(home: string, away: string, overrides: Partial<PublicMatch> & { date?: string } = {}): PublicMatch {
  const { date, ...rest } = overrides;
  const team = (name: string) => ({ entryId: name, teamId: `t-${name}`, name, shortName: name, slug: name.toLowerCase(), logoUrl: null });
  return {
    id: `m${++n}`,
    competition: { id: "c", slug: "c", name: "League", streamLabel: null, area: null, type: "league" },
    roundLabel: null,
    roundNumber: null,
    kickoffAt: date ? sastDateTime(date, "14:00") : null,
    kickoffTimeTbc: false,
    status: "scheduled",
    resultState: "provisional",
    outcomeType: "normal",
    home: team(home),
    away: team(away),
    venue: null,
    notes: null,
    result: null,
    ...rest,
  };
}
const final = (home: string, away: string, h: number, a: number, date: string) =>
  match(home, away, {
    date,
    status: "completed",
    resultState: "confirmed",
    result: toPublicResult({ ...raw, homeGoals: h, awayGoals: a, htHomeGoals: null, htAwayGoals: null, winnerEntryId: null }),
  });

describe("public views", () => {
  const ms = [
    final("A", "B", 2, 0, "2026-08-01"),
    final("B", "C", 1, 1, "2026-08-08"),
    match("A", "C", { date: "2026-08-15", status: "completed", resultState: "provisional" }),
    match("C", "A", { date: "2026-08-22" }),
    match("B", "A", { date: "2026-08-22", status: "postponed" }),
    match("C", "B"), // date TBC
  ];

  it("splits results (newest first) from fixtures (soonest first, TBC last)", () => {
    expect(resultsOf(ms).map((m) => m.kickoffAt?.toISOString().slice(0, 10))).toEqual(["2026-08-08", "2026-08-01"]);
    expect(fixturesOf(ms).map((m) => `${m.home.name}${m.away.name}`)).toEqual(["AC", "CA", "BA", "CB"]);
    expect(upcomingOf(ms).map((m) => `${m.home.name}${m.away.name}`)).toEqual(["CA", "BA", "CB"]);
  });

  it("groups by SAST date with a TBC group", () => {
    const groups = groupByDate(fixturesOf(ms));
    expect(groups.map((g) => [g.label, g.matches.length])).toEqual([
      ["15 August 2026", 1],
      ["22 August 2026", 2],
      ["Date to be confirmed", 1],
    ]);
  });

  it("groups knockout matches by round", () => {
    const ko = [match("A", "B", { roundLabel: "Semi-final" }), match("C", "D", { roundLabel: "Semi-final" }), match("A", "C", { roundLabel: "Final" })];
    expect(groupByRound(ko).map((g) => [g.label, g.matches.length])).toEqual([
      ["Semi-final", 2],
      ["Final", 1],
    ]);
  });

  it("builds the table from confirmed results only (provisional ignored)", () => {
    const entries = [ms[0]!.home, ms[0]!.away, ms[1]!.away]; // A, B, C
    const rows = standingsFor({ entries, matches: ms, adjustments: [], competition: { rules: DEFAULT_RULES } });
    // B and C both have 1 pt; C's GD (0) beats B's (−2). The provisional A–C result is ignored.
    expect(rows.map((r) => `${r.name} ${r.played} ${r.points}`)).toEqual(["A 1 3", "C 1 1", "B 2 1"]);
    expect(rows[0]!.team.slug).toBe("a");
  });

  it("maps public matches onto standings input without inventing scores", () => {
    const pending = match("A", "C", { date: "2026-08-15", status: "completed", resultState: "provisional" });
    expect(toStandingsMatch(pending)).toMatchObject({ homeGoals: null, awayGoals: null, resultState: "provisional" });
  });

  it("formats kickoff and competition subtitles", () => {
    expect(formatKickoff(match("A", "B", { date: "2026-08-15" }))).toBe("Sat, 15 Aug · 14:00");
    expect(formatKickoff(match("A", "B", { date: "2026-08-15", kickoffTimeTbc: true }))).toBe("Sat, 15 Aug · Time TBC");
    expect(formatKickoff(match("A", "B"))).toBe("Date TBC");
    expect(competitionSubtitle({ streamLabel: "Stream A", area: "Tseki" })).toBe("Stream A · Tseki");
    expect(competitionSubtitle({ streamLabel: null, area: null })).toBeNull();
  });
});

describe("branding and cache helpers", () => {
  it("picks readable text on brand colours", () => {
    expect(readableTextOn("#03300B")).toBe("#FFFFFF"); // Batho Pele green
    expect(readableTextOn("#E0A100")).toBe("#111111"); // demo amber
    expect(contrastRatio("#03300B", "#FFFFFF")).toBeGreaterThan(7);
  });

  it("invalidates org, competition, match and both teams after a result change", () => {
    expect(
      tagsForMatchChange({ organisationId: "o", competitionId: "c", matchId: "m", teamIds: ["t1", "t2"] }),
    ).toEqual(["org:o", "competition:c", "match:m", "team:t1", "team:t2"]);
  });
});
