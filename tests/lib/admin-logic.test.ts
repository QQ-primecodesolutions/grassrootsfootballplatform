import { describe, expect, it } from "vitest";
import { passwordMatches } from "@/lib/auth/password";
import { signSession, verifySession } from "@/lib/auth/session";
import { matchTeamName, type Candidate } from "@/lib/fixtures-paste/match";
import { parseFixtureText } from "@/lib/fixtures-paste/parse";
import { buildResultPatch, resultFormSchema, type ResultContext } from "@/lib/match/result-input";
import { facebookResultCaption, whatsappResultText, whatsappShareUrl } from "@/lib/share/captions";

const MATCH_ID = "3f2c1c9e-1111-4222-8333-944455556666";
const league: ResultContext = { competitionType: "league", homeEntryId: "H", awayEntryId: "A" };
const knockout: ResultContext = { ...league, competitionType: "knockout" };

const form = (fields: Record<string, string>) => resultFormSchema.parse({ matchId: MATCH_ID, intent: "confirm", status: "completed", ...fields });

describe("result entry rules", () => {
  it("confirms a normal league result and works out the winner", () => {
    const r = buildResultPatch(form({ homeGoals: "2", awayGoals: "1", htHome: "1", htAway: "0" }), league);
    expect(r).toEqual({
      ok: true,
      patch: expect.objectContaining({
        status: "completed",
        resultState: "confirmed",
        homeGoals: 2,
        awayGoals: 1,
        htHomeGoals: 1,
        htAwayGoals: 0,
        winnerEntryId: "H",
        penHome: null,
      }),
    });
  });

  it("saves a provisional draw with no winner", () => {
    const r = buildResultPatch(form({ intent: "provisional", homeGoals: "0", awayGoals: "0" }), league);
    expect(r.ok && r.patch).toMatchObject({ resultState: "provisional", winnerEntryId: null });
  });

  it("requires a full-time score, and both halves of every pair", () => {
    expect(buildResultPatch(form({}), league)).toEqual({ ok: false, errors: { score: "Enter the full-time score" } });
    const r = buildResultPatch(form({ homeGoals: "1", awayGoals: "1", htHome: "1" }), league);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.halfTime).toMatch(/both/);
  });

  it("rejects half-time goals above full-time", () => {
    const r = buildResultPatch(form({ homeGoals: "1", awayGoals: "0", htHome: "2", htAway: "0" }), league);
    expect(!r.ok && r.errors.halfTime).toMatch(/more than full-time/);
  });

  it("rejects extra time and penalties in a league", () => {
    const r = buildResultPatch(form({ homeGoals: "1", awayGoals: "1", penHome: "4", penAway: "3" }), league);
    expect(!r.ok && r.errors.penalties).toMatch(/League/);
  });

  it("settles a level knockout on penalties after extra time", () => {
    const r = buildResultPatch(
      form({ homeGoals: "1", awayGoals: "1", aetHome: "2", aetAway: "2", penHome: "4", penAway: "5" }),
      knockout,
    );
    expect(r.ok && r.patch).toMatchObject({ aetHomeGoals: 2, aetAwayGoals: 2, penHome: 4, penAway: 5, winnerEntryId: "A" });
  });

  it("insists a level knockout has a shootout, and that it isn't level", () => {
    expect(buildResultPatch(form({ homeGoals: "1", awayGoals: "1" }), knockout)).toMatchObject({
      ok: false,
      errors: { penalties: expect.stringMatching(/needs a winner/) },
    });
    const level = buildResultPatch(form({ homeGoals: "0", awayGoals: "0", penHome: "3", penAway: "3" }), knockout);
    expect(!level.ok && level.errors.penalties).toMatch(/can't end level/);
  });

  it("rejects extra time that lowers the score or follows a decisive result", () => {
    const lower = buildResultPatch(form({ homeGoals: "2", awayGoals: "2", aetHome: "1", aetAway: "3" }), knockout);
    expect(!lower.ok && lower.errors.extraTime).toMatch(/can't be lower/);
    const decisive = buildResultPatch(form({ homeGoals: "2", awayGoals: "1", aetHome: "2", aetAway: "1" }), knockout);
    expect(!decisive.ok && decisive.errors.extraTime).toMatch(/draw/);
  });

  it("records a walkover as a winner without goals", () => {
    expect(buildResultPatch(form({ outcome: "walkover" }), league)).toMatchObject({ ok: false, errors: { walkover: expect.any(String) } });
    const r = buildResultPatch(form({ outcome: "walkover", walkoverWinner: "away", homeGoals: "3", awayGoals: "0" }), league);
    expect(r.ok && r.patch).toMatchObject({ outcomeType: "walkover", winnerEntryId: "A", homeGoals: null, awayGoals: null });
  });

  it("keeps the entered score for an awarded result", () => {
    const r = buildResultPatch(form({ outcome: "awarded", homeGoals: "0", awayGoals: "2", notes: "Lere La Tshepe abandoned the match" }), league);
    expect(r.ok && r.patch).toMatchObject({ outcomeType: "awarded", homeGoals: 0, awayGoals: 2, winnerEntryId: "A", notes: "Lere La Tshepe abandoned the match" });
  });

  it("clears scores for postponed, cancelled and abandoned matches", () => {
    for (const status of ["postponed", "cancelled", "abandoned", "scheduled"]) {
      const r = buildResultPatch(form({ status, homeGoals: "2", awayGoals: "1" }), league);
      expect(r.ok && r.patch).toMatchObject({ status, resultState: "provisional", homeGoals: null, winnerEntryId: null });
    }
  });

  it("validates numbers from the form", () => {
    expect(() => form({ homeGoals: "-1", awayGoals: "0" })).toThrow();
    expect(() => form({ homeGoals: "1.5", awayGoals: "0" })).toThrow();
    expect(form({ homeGoals: "", awayGoals: "" }).homeGoals).toBeNull();
  });
});

describe("share captions", () => {
  const input = {
    homeName: "Tseki Junior Stars FC",
    awayName: "Samba Boys FC",
    score: "2–1",
    details: ["HT 1–0"],
    competitionName: "QwaQwa Development League Open",
    competitionSubtitle: "Stream A · Tseki",
    roundLabel: "Round 7",
    dateLabel: "Sat, 15 Aug",
    venueName: null,
    hashtags: ["#ITSTIMETOSHINE", "#QDL", "#BathoPeleKasiSoccerTournament"],
    matchUrl: "https://example.org/batho-pele/match/x",
    tableUrl: "https://example.org/batho-pele/qdl-open-stream-a-2026",
  };

  it("builds a short WhatsApp message with the link", () => {
    expect(whatsappResultText(input)).toBe(
      "FULL TIME: Tseki Junior Stars FC 2–1 Samba Boys FC\nQwaQwa Development League Open · Stream A · Tseki · Round 7\nhttps://example.org/batho-pele/match/x",
    );
    expect(whatsappShareUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("builds a Facebook caption with the organisation's hashtags", () => {
    const caption = facebookResultCaption(input);
    expect(caption).toContain("Tseki Junior Stars FC 2–1 Samba Boys FC\nHT 1–0");
    expect(caption).toContain("Sat, 15 Aug");
    expect(caption.endsWith("#ITSTIMETOSHINE #QDL #BathoPeleKasiSoccerTournament")).toBe(true);
  });
});

describe("bulk paste parsing", () => {
  it("parses WhatsApp-style fixture lines", () => {
    const { fixtures, ignored } = parseFixtureText(
      [
        "*ROUND 8 FIXTURES*",
        "1. Passion FC vs Samba Boys",
        "2) 14:00 Tseki Jnr Stars v Remember Matoota",
        "⚽ Lere La Tshepe VERSUS Tseki Galaxy 2pm",
        "- Samba Boys vs. Passion 2:30 pm",
        "",
        "Venue: Itlotliseng",
      ].join("\n"),
    );
    expect(fixtures.map(({ home, away, time, lineNo }) => ({ home, away, time, lineNo }))).toEqual([
      { home: "Passion FC", away: "Samba Boys", time: null, lineNo: 2 },
      { home: "Tseki Jnr Stars", away: "Remember Matoota", time: "14:00", lineNo: 3 },
      { home: "Lere La Tshepe", away: "Tseki Galaxy", time: "14:00", lineNo: 4 },
      { home: "Samba Boys", away: "Passion", time: "14:30", lineNo: 5 },
    ]);
    expect(ignored.map((i) => i.lineNo)).toEqual([1, 7]);
  });

  it("does not treat a hyphen or a 'v' inside a name as a separator", () => {
    expect(parseFixtureText("Mo-Afrika vs Victory Stars").fixtures[0]).toMatchObject({ home: "Mo-Afrika", away: "Victory Stars" });
    expect(parseFixtureText("Passion - Samba Boys").fixtures).toEqual([]);
  });

  it("accepts 14h00 and 14.00 times", () => {
    expect(parseFixtureText("A vs B 14h00").fixtures[0]!.time).toBe("14:00");
    expect(parseFixtureText("A vs B 09.30").fixtures[0]!.time).toBe("09:30");
  });
});

describe("team name matching (competition-scoped)", () => {
  const streamA: Candidate[] = [
    { entryId: "tjs", name: "Tseki Junior Stars FC", aliases: ["Tseki Junior Stars", "Tseki Jnr Stars"] },
    { entryId: "rm", name: "Remember Matoota FC", aliases: ["Remember Matoota"] },
    { entryId: "tg", name: "Tseki Galaxy FC", aliases: ["Tseki Galaxy"] },
  ];

  it("matches names and aliases with or without FC", () => {
    expect(matchTeamName("Tseki Jnr Stars", streamA)).toEqual({ status: "matched", entryId: "tjs" });
    expect(matchTeamName("REMEMBER MATOOTA F.C.", streamA)).toEqual({ status: "matched", entryId: "rm" });
  });

  it("suggests close names instead of guessing", () => {
    const r = matchTeamName("Junior Stars", streamA);
    expect(r).toEqual({ status: "unmatched", suggestions: expect.arrayContaining(["tjs"]) });
    expect(r.status === "unmatched" && r.suggestions[0]).toBe("tjs");
    expect(matchTeamName("Dynamos FC", streamA)).toEqual({ status: "unmatched", suggestions: [] });
  });

  it("flags names that fit two teams", () => {
    const both: Candidate[] = [
      { entryId: "p1", name: "Passion FC", aliases: [] },
      { entryId: "p2", name: "Passion Juniors", aliases: ["Passion"] },
    ];
    expect(matchTeamName("Passion", both)).toEqual({ status: "ambiguous", options: ["p1", "p2"] });
  });
});

describe("admin session", () => {
  const secret = "x".repeat(40);

  it("signs and verifies, and rejects tampering, wrong secrets and expiry", async () => {
    const token = await signSession({ sub: "admin", orgId: "org-1" }, secret);
    expect(await verifySession(token, secret)).toEqual({ sub: "admin", orgId: "org-1" });
    expect(await verifySession(token, "y".repeat(40))).toBeNull();
    expect(await verifySession(token.slice(0, -2) + "xx", secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
    const old = await signSession({ sub: "admin", orgId: "org-1" }, secret, new Date("2020-01-01"));
    expect(await verifySession(old, secret)).toBeNull();
  });

  it("compares passwords exactly", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("correct hors", "correct horse")).toBe(false);
    expect(passwordMatches("", "correct horse")).toBe(false);
  });
});
