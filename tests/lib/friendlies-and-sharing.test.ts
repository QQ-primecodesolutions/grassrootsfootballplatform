import { describe, expect, it } from "vitest";
import { upcomingMatchDays } from "@/lib/admin/match-lists";
import { competitionCreateSchema } from "@/lib/competitions/input";
import type { AdminMatch } from "@/lib/db/queries/admin";
import { buildResultPatch, resultFormSchema, type ResultContext } from "@/lib/match/result-input";
import { whatsappFixturesText, whatsappMatchPreviewText } from "@/lib/share/fixtures";
import { sastDateTime } from "@/lib/time";

const MATCH_ID = "3f2c1c9e-1111-4222-8333-944455556666";
const friendly: ResultContext = { competitionType: "friendly", homeEntryId: "H", awayEntryId: "A" };
const knockout: ResultContext = { ...friendly, competitionType: "knockout" };
const form = (fields: Record<string, string>) =>
  resultFormSchema.parse({ matchId: MATCH_ID, intent: "confirm", status: "completed", ...fields });

describe("friendly results", () => {
  it("may end level with no shootout", () => {
    const r = buildResultPatch(form({ homeGoals: "2", awayGoals: "2" }), friendly);
    expect(r.ok && r.patch).toMatchObject({ homeGoals: 2, awayGoals: 2, winnerEntryId: null, penHome: null });
    // A knockout still needs a winner.
    expect(buildResultPatch(form({ homeGoals: "2", awayGoals: "2" }), knockout).ok).toBe(false);
  });

  it("may be settled by extra time or a shootout", () => {
    const pens = buildResultPatch(form({ homeGoals: "1", awayGoals: "1", penHome: "3", penAway: "4" }), friendly);
    expect(pens.ok && pens.patch).toMatchObject({ penHome: 3, penAway: 4, winnerEntryId: "A" });
    const aet = buildResultPatch(form({ homeGoals: "1", awayGoals: "1", aetHome: "2", aetAway: "1" }), friendly);
    expect(aet.ok && aet.patch).toMatchObject({ aetHomeGoals: 2, winnerEntryId: "H" });
  });

  it("still rejects a shootout after a decisive score", () => {
    const r = buildResultPatch(form({ homeGoals: "2", awayGoals: "1", penHome: "3", penAway: "4" }), friendly);
    expect(!r.ok && r.errors.penalties).toMatch(/only follow a draw/);
  });

  it("can be created as a competition format", () => {
    expect(competitionCreateSchema.parse({ name: "Friendlies", type: "friendly", season: "2026", slug: "friendlies-2026" }).type).toBe(
      "friendly",
    );
  });
});

describe("fixtures share text", () => {
  const base = {
    competitionLine: "QwaQwa Development League Open · Stream A",
    dateLabel: "Sat, 17 Oct",
    hashtags: ["#KasiSoccer"],
    url: "https://example.com/batho-pele/qdl/fixtures",
  };

  it("lists each fixture with time and venue, then the link", () => {
    expect(
      whatsappFixturesText({
        ...base,
        fixtures: [
          { homeName: "Passion FC", awayName: "Samba Boys FC", time: "12:00", venueName: "Tseki Stadium", roundLabel: "Round 8" },
          { homeName: "Tseki Galaxy FC", awayName: "Lere La Tshepe FC", time: null, venueName: null, roundLabel: "Round 8" },
        ],
      }),
    ).toBe(
      [
        "FIXTURES · Sat, 17 Oct\nQwaQwa Development League Open · Stream A · Round 8",
        "12:00  Passion FC vs Samba Boys FC (Tseki Stadium)\nTBC  Tseki Galaxy FC vs Lere La Tshepe FC",
        "https://example.com/batho-pele/qdl/fixtures",
        "#KasiSoccer",
      ].join("\n\n"),
    );
  });

  it("shows mixed rounds per fixture", () => {
    const text = whatsappFixturesText({
      ...base,
      hashtags: [],
      fixtures: [
        { homeName: "A", awayName: "B", time: "10:00", venueName: null, roundLabel: "Semi-final" },
        { homeName: "C", awayName: "D", time: "14:00", venueName: null, roundLabel: "3rd place" },
      ],
    });
    expect(text).toContain("10:00  A vs B (Semi-final)\n14:00  C vs D (3rd place)");
    expect(text.endsWith("/fixtures")).toBe(true);
  });

  it("announces a single match", () => {
    expect(
      whatsappMatchPreviewText({
        homeName: "Passion FC",
        awayName: "Mabolela United",
        time: null,
        venueName: "Tseki Stadium",
        roundLabel: null,
        competitionLine: "Friendlies",
        dateLabel: "Sun, 18 Oct",
        hashtags: [],
        matchUrl: "https://example.com/m/1",
      }),
    ).toBe("MATCH DAY: Passion FC vs Mabolela United\n\nSun, 18 Oct · time TBC · Tseki Stadium\nFriendlies\n\nhttps://example.com/m/1");
  });
});

describe("upcoming match days", () => {
  const m = (id: string, competitionId: string, date: string, time: string, status: AdminMatch["status"] = "scheduled") =>
    ({ id, competitionId, competitionName: competitionId.toUpperCase(), streamLabel: null, kickoffAt: sastDateTime(date, time), status }) as AdminMatch;

  it("groups scheduled fixtures by day and competition, from today, soonest first", () => {
    const days = upcomingMatchDays(
      [
        m("1", "cup", "2026-10-18", "10:00"),
        m("2", "league", "2026-10-17", "14:00"),
        m("3", "league", "2026-10-17", "12:00"),
        m("4", "league", "2026-10-08", "12:00"),
        m("5", "league", "2026-10-17", "16:00", "postponed"),
        m("6", "league", "2026-10-09", "23:30"),
      ],
      "2026-10-09",
    );
    expect(days.map((d) => [d.date, d.competitionId, d.matches.map((x) => x.id)])).toEqual([
      ["2026-10-09", "league", ["6"]],
      ["2026-10-17", "league", ["3", "2"]],
      ["2026-10-18", "cup", ["1"]],
    ]);
  });
});
