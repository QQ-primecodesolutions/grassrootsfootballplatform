import { describe, expect, it } from "vitest";
import type { CompetitionData, PublicOrganisation } from "@/lib/db/queries";
import { fixturesModel, latestResultDate, matchCardModel, matchdayModel, nextFixtureDate } from "@/lib/graphics/model";
import { fitFontSize, wrapLines } from "@/lib/graphics/parts";
import { CACHE_UNVERSIONED, CACHE_VERSIONED, notFoundResponse, pngResponse } from "@/lib/graphics/response";
import { parseGraphicQuery } from "@/lib/graphics/sizes";
import { graphicPath, graphicVersion } from "@/lib/graphics/urls";
import { toPublicResult, type PublicMatch, type PublicTeamRef } from "@/lib/match/public";
import { DEFAULT_RULES } from "@/lib/rules";
import { sastDateTime } from "@/lib/time";
import { STREAM_A_TEAMS } from "@/scripts/seed/data/batho-pele-stream-a";
import { loadStreamAFixture } from "@/scripts/seed/stream-a-fixture";
import { PUBLISHED_TABLE_2026_08_15 } from "../fixtures/published-table-2026-08-15";

const org: PublicOrganisation = {
  id: "o",
  slug: "batho-pele",
  name: "Batho Pele Kasi Soccer Tournament",
  shortName: "Batho Pele",
  logoUrl: "/brand/batho-pele.png",
  primaryColor: "#03300B",
  secondaryColor: "#1E6B34",
  accentColor: null,
  textColor: "#111111",
  backgroundColor: "#F4F4F2",
  tagline: "ONE GAME. ONE PASSION. ONE LEAGUE.",
  hashtags: ["#QDL"],
  socialLinks: { facebook: "https://facebook.com/example" },
};

const team = (name: string): PublicTeamRef => ({ entryId: name, teamId: `t-${name}`, name, shortName: name, slug: name.toLowerCase(), logoUrl: null });

let n = 0;
function match(home: string, away: string, overrides: Partial<PublicMatch> & { date?: string; time?: string } = {}): PublicMatch {
  const { date, time, ...rest } = overrides;
  return {
    id: `m${String(++n).padStart(3, "0")}`,
    competition: { id: "c", slug: "league", name: "League", streamLabel: "Stream A", area: "Tseki", type: "league" },
    roundLabel: null,
    roundNumber: null,
    kickoffAt: date ? sastDateTime(date, time ?? "14:00") : null,
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

type Raw = Parameters<typeof toPublicResult>[0];
const raw: Omit<Raw, "homeGoals" | "awayGoals"> = {
  status: "completed",
  resultState: "confirmed",
  outcomeType: "normal",
  htHomeGoals: null,
  htAwayGoals: null,
  aetHomeGoals: null,
  aetAwayGoals: null,
  penHome: null,
  penAway: null,
  winnerEntryId: null,
};
const final = (home: string, away: string, h: number, a: number, date: string, extra: Partial<Raw> = {}) =>
  match(home, away, {
    date,
    status: "completed",
    resultState: "confirmed",
    outcomeType: extra.outcomeType ?? "normal",
    result: toPublicResult({ ...raw, ...extra, homeGoals: h, awayGoals: a }),
  });
/** A provisional result: as it arrives from the query layer, with the score already stripped. */
const provisional = (home: string, away: string, date: string) =>
  match(home, away, {
    date,
    status: "completed",
    resultState: "provisional",
    result: toPublicResult({ ...raw, resultState: "provisional", homeGoals: 9, awayGoals: 9 }),
  });

function data(entries: string[], matches: PublicMatch[]): CompetitionData {
  return {
    competition: {
      id: "c",
      slug: "league",
      name: "QwaQwa Development League Open",
      type: "league",
      streamLabel: "Stream A",
      area: "Tseki",
      slogan: "It's time to shine",
      logoUrl: null,
      socialLinks: {},
      isFeatured: true,
      seasonName: "2026",
      rules: DEFAULT_RULES,
      expectedMatchCount: null,
    },
    entries: entries.map(team),
    matches,
    adjustments: [],
    sponsors: [{ name: "Mayday Alarms", logoUrl: null, websiteUrl: null }],
  };
}

describe("matchday graphic model", () => {
  it("reproduces the organiser's 15 Aug 2026 graphic from the 21 Stream A results", () => {
    const fixture = loadStreamAFixture();
    const matches = fixture.results.map((r) =>
      final(r.home, r.away, r.homeGoals, r.awayGoals, r.date, { outcomeType: r.outcome ?? "normal" }),
    );
    const model = matchdayModel(org, data(STREAM_A_TEAMS.map((t) => t.name), matches), null);

    expect(model.date).toBe("2026-08-15");
    expect(model.dateLabel).toBe("15 August 2026");
    expect(
      model.rows.map((r) => [r.position, r.name, r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.goalDifference, r.points]),
    ).toEqual(
      PUBLISHED_TABLE_2026_08_15.map((r) => [String(r.position), r.name, r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.goalDifference, r.points]),
    );
    // "Today's results" on the published graphic.
    expect(model.results.map((r) => `${r.home} ${r.score} ${r.away}`).sort()).toEqual([
      "Remember Matoota FC 0-0 Passion FC",
      "Tseki Galaxy FC 1-2 Lere La Tshepe FC",
      "Tseki Junior Stars FC 2-1 Samba Boys FC",
    ]);
    expect(model.top.map((r) => [r.name, r.points])).toEqual([
      ["Tseki Junior Stars FC", 17],
      ["Remember Matoota FC", 11],
      ["Passion FC", 10],
    ]);
  });

  it("is as at the requested date and ignores later results", () => {
    const d = data(["A", "B", "C"], [final("A", "B", 1, 0, "2026-08-01"), final("C", "A", 3, 0, "2026-08-08")]);
    const model = matchdayModel(org, d, "2026-08-01");
    expect(model.rows.find((r) => r.name === "A")).toMatchObject({ played: 1, points: 3 });
    expect(model.rows.find((r) => r.name === "C")).toMatchObject({ played: 0 });
    expect(model.results).toEqual([{ home: "A", away: "B", score: "1-0", note: null }]);
  });

  it("never shows a provisional result, and marks shared positions", () => {
    const d = data(["A", "B", "C", "D"], [final("A", "B", 1, 1, "2026-08-01"), provisional("C", "D", "2026-08-01")]);
    const model = matchdayModel(org, d, null);
    expect(model.results).toHaveLength(1);
    expect(JSON.stringify(model)).not.toContain("9-9");
    expect(model.rows.map((r) => r.position)).toEqual(["1=", "1=", "3=", "3="]);
    expect(model.rows.find((r) => r.name === "C")!.played).toBe(0);
  });

  it("handles a season with no results yet", () => {
    const model = matchdayModel(org, data(["A", "B"], [match("A", "B", { date: "2026-08-01" })]), null);
    expect(model).toMatchObject({ date: null, dateLabel: null, results: [] });
    expect(model.rows).toHaveLength(2);
  });

  it("shows the Facebook icon when only the competition brand has a page", () => {
    const d = data(["A"], []);
    const withQdl = { ...d, competition: { ...d.competition, socialLinks: { facebook: "https://www.facebook.com/x" } } };
    expect(matchdayModel({ ...org, socialLinks: {} }, d, null).brand.social.facebook).toBe(false);
    expect(matchdayModel({ ...org, socialLinks: {} }, withQdl, null).brand.social.facebook).toBe(true);
  });

  it("carries branding, and social icons only for supplied links", () => {
    const { brand } = matchdayModel(org, data(["A"], []), null);
    expect(brand).toMatchObject({
      orgLogoUrl: "/brand/batho-pele.png",
      competitionSubtitle: "Stream A · Tseki",
      slogan: "It's time to shine",
      social: { facebook: true, instagram: false, x: false },
      sponsors: [{ name: "Mayday Alarms", logoUrl: null }],
    });
    expect(brand.colors.onPrimary).toBe("#FFFFFF");
  });
});

describe("result notes and match cards", () => {
  it("labels walkovers, awarded results, extra time and penalties", () => {
    const d = data(["A", "B"], [
      final("A", "B", 0, 0, "2026-08-01", { outcomeType: "walkover", winnerEntryId: "A" }),
      final("A", "B", 0, 2, "2026-08-02", { outcomeType: "awarded" }),
      final("A", "B", 1, 1, "2026-08-03", { aetHomeGoals: 2, aetAwayGoals: 2, penHome: 4, penAway: 3 }),
    ]);
    expect(matchdayModel(org, d, "2026-08-01").results[0]).toMatchObject({ score: "W/O", note: "W/O to A" });
    expect(matchdayModel(org, d, "2026-08-02").results[0]).toMatchObject({ score: "0-2", note: "Awarded" });
    expect(matchdayModel(org, d, "2026-08-03").results[0]).toMatchObject({ score: "2-2", note: "Pens 4-3" });
    expect(matchCardModel(org, d, d.matches[0]!).details).toEqual(["Walkover: A win"]);
    expect(matchCardModel(org, d, d.matches[2]!)).toMatchObject({
      state: "final",
      score: "2-2",
      details: ["AET · 90 mins 1-1", "Penalties 4-3"],
    });
  });

  it("shows no score for provisional, scheduled or postponed matches", () => {
    const pending = provisional("A", "B", "2026-08-01");
    const d = data(["A", "B"], [pending]);
    expect(matchCardModel(org, d, pending)).toMatchObject({ state: "pending", score: null, details: [] });
    const later = match("A", "B", { date: "2026-08-08", time: "10:30" });
    expect(matchCardModel(org, d, later)).toMatchObject({ state: "scheduled", score: null, dateLabel: "08 August 2026", timeLabel: "10:30" });
    expect(matchCardModel(org, d, { ...later, status: "postponed" }).state).toBe("postponed");
    expect(matchCardModel(org, d, { ...later, kickoffTimeTbc: true }).timeLabel).toBeNull();
  });
});

describe("fixtures graphic model", () => {
  it("defaults to the next date with a scheduled or postponed match, in kickoff order", () => {
    const ms = [
      final("A", "B", 1, 0, "2026-08-01"),
      match("C", "D", { date: "2026-08-08", time: "12:00", venue: { name: "Itlotliseng Sports Ground", area: null } }),
      match("A", "C", { date: "2026-08-08", time: "10:00", kickoffTimeTbc: true }),
      match("B", "D", { date: "2026-08-08", time: "14:00", status: "postponed" }),
      match("A", "D", { date: "2026-08-15" }),
    ];
    expect(nextFixtureDate(ms)).toBe("2026-08-08");
    expect(latestResultDate(ms)).toBe("2026-08-01");
    const model = fixturesModel(org, data(["A", "B", "C", "D"], ms), null);
    expect(model.dateLabel).toBe("08 August 2026");
    expect(model.fixtures).toEqual([
      { home: "A", away: "C", time: "TBC", venue: null, roundLabel: null },
      { home: "C", away: "D", time: "12:00", venue: "Itlotliseng Sports Ground", roundLabel: null },
      { home: "B", away: "D", time: "POSTPONED", venue: null, roundLabel: null },
    ]);
    expect(fixturesModel(org, data([], []), null)).toMatchObject({ date: null, fixtures: [] });
  });
});

describe("graphic query, URLs and responses", () => {
  it("parses size, date, download and version, rejecting bad input", () => {
    expect(parseGraphicQuery(new URLSearchParams())).toEqual({ size: "portrait", download: false, date: null, versioned: false });
    expect(parseGraphicQuery(new URLSearchParams("size=square&date=2026-08-15&download=1&v=abc123"))).toEqual({
      size: "square",
      download: true,
      date: "2026-08-15",
      versioned: true,
    });
    expect(parseGraphicQuery(new URLSearchParams("size=huge"))).toBeNull();
    expect(parseGraphicQuery(new URLSearchParams("date=15-08-2026"))).toBeNull();
    expect(parseGraphicQuery(new URLSearchParams("v=<script>"))).toBeNull();
  });

  it("builds graphic paths", () => {
    expect(graphicPath({ kind: "result", org: "batho-pele", matchId: "m1" })).toBe("/graphics/batho-pele/result/m1");
    expect(graphicPath({ kind: "matchday", org: "demo", competition: "league" }, { size: "square", v: "abc", download: true })).toBe(
      "/graphics/demo/matchday/league?size=square&v=abc&download=1",
    );
    expect(graphicPath({ kind: "fixtures", org: "demo", competition: "league" }, { size: "portrait", date: "2026-08-08" })).toBe(
      "/graphics/demo/fixtures/league?date=2026-08-08",
    );
  });

  it("changes the version whenever the drawn data changes", () => {
    const a = data(["A", "B"], [final("A", "B", 1, 0, "2026-08-01")]);
    const b = { ...a, matches: [{ ...a.matches[0]!, result: toPublicResult({ ...raw, homeGoals: 2, awayGoals: 0 }) }] };
    expect(graphicVersion(org, a)).toMatch(/^[0-9a-f]{12}$/);
    expect(graphicVersion(org, a)).toBe(graphicVersion(org, structuredClone(a)));
    expect(graphicVersion(org, a)).not.toBe(graphicVersion(org, b));
    expect(graphicVersion(org, a)).not.toBe(graphicVersion({ ...org, tagline: "New" }, a));
  });

  it("caches versioned URLs long and others briefly; 404s are never cached", () => {
    const graphic = { bytes: new Uint8Array([1, 2, 3]), filename: "a-v-b-result-portrait.png" };
    const long = pngResponse(graphic, { download: true, versioned: true });
    expect(long.headers.get("Content-Type")).toBe("image/png");
    expect(long.headers.get("Cache-Control")).toBe(CACHE_VERSIONED);
    expect(long.headers.get("Content-Disposition")).toBe('attachment; filename="a-v-b-result-portrait.png"');
    const short = pngResponse(graphic, { download: false, versioned: false });
    expect(short.headers.get("Cache-Control")).toBe(CACHE_UNVERSIONED);
    expect(short.headers.get("Content-Disposition")).toBeNull();
    expect(notFoundResponse().headers.get("Cache-Control")).toBe("no-store");
  });

  it("sizes team names by their longest word, so they wrap between words", () => {
    // Regression: names without an "s" were sized as one long word.
    expect(fitFontSize("Remember Matoota FC", 234, 88)).toBe(fitFontSize("REMEMBER", 234, 88));
    expect(fitFontSize("Remember Matoota FC", 234, 88)).toBe(63);
    expect(fitFontSize("Passion FC", 234, 88)).toBe(72);
    expect(fitFontSize("FC", 234, 88)).toBe(88);
  });

  it("wraps long names by words", () => {
    expect(wrapLines("REMEMBER MATOOTA FC", 10)).toEqual(["REMEMBER", "MATOOTA FC"]);
    expect(wrapLines("TSEKI JUNIOR STARS FC", 40)).toEqual(["TSEKI JUNIOR STARS FC"]);
    expect(wrapLines("SUPERCALIFRAGILISTIC FC", 8)).toEqual(["SUPERCALIFRAGILISTIC", "FC"]);
  });
});
