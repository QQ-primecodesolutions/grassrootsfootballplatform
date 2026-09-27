import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/rules";
import { computeStandings, type StandingsMatch } from "@/lib/standings";
import { createRng } from "@/scripts/seed/generate";
import { expectInvariants, result, rules, summary, team } from "./helpers";

const [A, B, C, D, E] = ["A", "B", "C", "D", "E"].map(team) as [
  ReturnType<typeof team>,
  ReturnType<typeof team>,
  ReturnType<typeof team>,
  ReturnType<typeof team>,
  ReturnType<typeof team>,
];

describe("computeStandings: basics", () => {
  it("counts W/D/L, goals and points", () => {
    const matches = [result("A", "B", 2, 1), result("A", "C", 0, 0), result("B", "C", 3, 0)];
    const rows = computeStandings([A, B, C], matches, DEFAULT_RULES);
    expect(summary(rows)).toEqual(["1 A 2 1 1 0 2 1 4", "2 B 2 1 0 1 4 2 3", "3 C 2 0 1 1 0 3 1"]);
    expect(rows[0]).toMatchObject({ goalDifference: 1, adjustment: 0, form: ["W", "D"], tied: false });
    expectInvariants(rows, DEFAULT_RULES);
  });

  it("computes a full round-robin", () => {
    const matches = [
      result("A", "B", 3, 0),
      result("C", "D", 1, 1),
      result("A", "C", 1, 2),
      result("B", "D", 2, 0),
      result("D", "A", 0, 2),
      result("B", "C", 1, 1),
    ];
    const rows = computeStandings([A, B, C, D], matches, DEFAULT_RULES);
    expect(summary(rows)).toEqual([
      "1 A 3 2 0 1 6 2 6",
      "2 C 3 1 2 0 4 3 5",
      "3 B 3 1 1 1 3 4 4",
      "4 D 3 0 1 2 1 5 1",
    ]);
    expectInvariants(rows, DEFAULT_RULES);
  });

  it("includes teams with no matches yet", () => {
    const rows = computeStandings([A, B, C], [result("A", "B", 1, 0)], DEFAULT_RULES);
    expect(rows.find((r) => r.entryId === "c")).toMatchObject({ played: 0, points: 0, form: [] });
    expectInvariants(rows, DEFAULT_RULES);
  });

  it("uses configured points", () => {
    const r = rules({ points: { win: 2, draw: 1, loss: 0 } });
    const rows = computeStandings([A, B], [result("A", "B", 1, 0), result("B", "A", 1, 1)], r);
    expect(rows.map((x) => x.points)).toEqual([3, 1]);
    expectInvariants(rows, r);
  });
});

describe("computeStandings: which matches count", () => {
  it("ignores unconfirmed, postponed, cancelled, abandoned and scheduled matches", () => {
    const matches: StandingsMatch[] = [
      result("A", "B", 1, 0),
      result("A", "C", 5, 0, { resultState: "provisional" }),
      result("B", "C", null, null, { status: "postponed", resultState: "provisional" }),
      result("B", "C", null, null, { status: "cancelled" }),
      result("A", "C", 2, 2, { status: "abandoned" }),
      result("C", "A", null, null, { status: "scheduled", resultState: "provisional" }),
    ];
    const rows = computeStandings([A, B, C], matches, DEFAULT_RULES);
    // C (no games, GD 0) ranks above B (GD −1).
    expect(summary(rows)).toEqual(["1 A 1 1 0 0 1 0 3", "2 C 0 0 0 0 0 0 0", "3 B 1 0 0 1 0 1 0"]);
    expectInvariants(rows, DEFAULT_RULES);
  });

  it("ignores matches involving teams not in the competition", () => {
    const rows = computeStandings([A, B], [result("A", "B", 1, 1), result("A", "Z", 9, 0)], DEFAULT_RULES);
    expect(summary(rows)).toEqual(["1= A 1 0 1 0 1 1 1", "1= B 1 0 1 0 1 1 1"]);
  });

  it("filters by an as-of date (SAST, inclusive), including adjustments", () => {
    const matches = [
      result("A", "B", 1, 0, { kickoffAt: "2026-08-15T12:00:00Z" }),
      // 23:30 UTC on the 15th is 01:30 SAST on the 16th: excluded.
      result("B", "A", 3, 0, { kickoffAt: "2026-08-15T23:30:00Z" }),
    ];
    const adjustments = [{ entryId: "a", points: -3, effectiveOn: "2026-08-16" }];
    const asOf = computeStandings([A, B], matches, DEFAULT_RULES, adjustments, { asOf: "2026-08-15" });
    expect(summary(asOf)).toEqual(["1 A 1 1 0 0 1 0 3", "2 B 1 0 0 1 0 1 0"]);
    const now = computeStandings([A, B], matches, DEFAULT_RULES, adjustments);
    expect(summary(now)).toEqual(["1 B 2 1 0 1 3 1 3", "2 A 2 1 0 1 1 3 0"]);
  });
});

describe("computeStandings: walkovers, awarded results, extra time and shootouts", () => {
  const walkover = (home: string, away: string, winner: string) =>
    result(home, away, null, null, { outcomeType: "walkover", winnerEntryId: winner.toLowerCase() });

  it("applies the configured walkover score when goals count", () => {
    const rows = computeStandings([A, B], [walkover("A", "B", "B")], DEFAULT_RULES);
    expect(summary(rows)).toEqual(["1 B 1 1 0 0 3 0 3", "2 A 1 0 0 1 0 3 0"]);
    expectInvariants(rows, DEFAULT_RULES);
  });

  it("counts the result but not the goals when countGoals is false", () => {
    const r = rules({ walkover: { score: [3, 0], countGoals: false } });
    const rows = computeStandings([A, B], [walkover("A", "B", "A")], r);
    expect(summary(rows)).toEqual(["1 A 1 1 0 0 0 0 3", "2 B 1 0 0 1 0 0 0"]);
    expectInvariants(rows, r);
  });

  it("uses the entered score for awarded results, even when walkover goals are off", () => {
    const r = rules({ walkover: { score: [3, 0], countGoals: false } });
    const rows = computeStandings([A, B], [result("A", "B", 0, 2, { outcomeType: "awarded" })], r);
    expect(summary(rows)).toEqual(["1 B 1 1 0 0 2 0 3", "2 A 1 0 0 1 0 2 0"]);
  });

  it("never counts a penalty shootout as goals or points", () => {
    const rows = computeStandings([A, B], [result("A", "B", 1, 1, { penHome: 5, penAway: 4 })], DEFAULT_RULES);
    expect(summary(rows)).toEqual(["1= A 1 0 1 0 1 1 1", "1= B 1 0 1 0 1 1 1"]);
    expect(rows.map((r) => r.form)).toEqual([["D"], ["D"]]);
    expectInvariants(rows, DEFAULT_RULES);
  });

  it("uses the score after extra time when present", () => {
    const m = result("A", "B", 1, 1, { aetHomeGoals: 1, aetAwayGoals: 2 });
    const rows = computeStandings([A, B], [m], DEFAULT_RULES);
    expect(summary(rows)).toEqual(["1 B 1 1 0 0 2 1 3", "2 A 1 0 0 1 1 2 0"]);
  });

  it("rejects inconsistent data instead of guessing", () => {
    expect(() => computeStandings([A, B], [walkover("A", "B", "C")], DEFAULT_RULES)).toThrow(/winner/);
    expect(() => computeStandings([A, B], [result("A", "B", null, null)], DEFAULT_RULES)).toThrow(/no score/);
    expect(() => computeStandings([A, B], [result("A", "B", 1, 0, { kickoffAt: null })], DEFAULT_RULES)).toThrow(
      /kickoff/,
    );
  });
});

describe("computeStandings: adjustments", () => {
  it("applies a points deduction that changes positions", () => {
    const matches = [result("A", "C", 2, 0), result("B", "C", 1, 0), result("A", "B", 1, 1)];
    const before = computeStandings([A, B, C], matches, DEFAULT_RULES);
    expect(before.map((r) => r.name)).toEqual(["A", "B", "C"]);

    const deduction = [{ entryId: "a", points: -3, reason: "Unregistered player", effectiveOn: "2026-01-10" }];
    const after = computeStandings([A, B, C], matches, DEFAULT_RULES, deduction);
    expect(summary(after)).toEqual(["1 B 2 1 1 0 2 1 4", "2 A 2 1 1 0 3 1 1", "3 C 2 0 0 2 0 3 0"]);
    expect(after[1]).toMatchObject({ adjustment: -3 });
    expectInvariants(after, DEFAULT_RULES);
  });

  it("sums several adjustments for the same team", () => {
    const adjustments = [
      { entryId: "a", points: -3, effectiveOn: "2026-01-01" },
      { entryId: "a", points: 1, effectiveOn: "2026-01-02" },
    ];
    const rows = computeStandings([A, B], [result("A", "B", 1, 0)], DEFAULT_RULES, adjustments);
    expect(rows.find((r) => r.entryId === "a")).toMatchObject({ adjustment: -2, points: 1 });
  });
});

describe("computeStandings: tie-breakers", () => {
  it("separates teams level on points by goal difference", () => {
    const matches = [result("A", "C", 3, 0), result("B", "C", 1, 0), result("A", "B", 0, 0)];
    const rows = computeStandings([A, B, C], matches, DEFAULT_RULES);
    expect(rows.map((r) => `${r.position} ${r.name} ${r.goalDifference}`)).toEqual(["1 A 3", "2 B 1", "3 C -4"]);
  });

  it("separates teams level on points and GD by goals scored", () => {
    const matches = [result("A", "C", 3, 2), result("B", "C", 1, 0), result("A", "B", 0, 0)];
    const rows = computeStandings([A, B, C], matches, DEFAULT_RULES);
    expect(rows.map((r) => r.name)).toEqual(["A", "B", "C"]);
    expect(rows[0]!.goalDifference).toBe(rows[1]!.goalDifference);
  });

  it("uses a head-to-head mini-table among three tied teams", () => {
    // A, B, C all finish on 4 points. Among themselves: A 4 pts, B 3, C 1.
    const matches = [
      result("A", "B", 2, 0),
      result("A", "C", 0, 0),
      result("B", "C", 1, 0),
      result("E", "A", 1, 0),
      result("B", "D", 1, 1),
      result("C", "D", 2, 0),
    ];
    const headToHeadFirst = rules({ tieBreakers: ["points", "headToHead", "goalDifference", "goalsFor"] });
    const rows = computeStandings([A, B, C, D, E], matches, headToHeadFirst);
    expect(rows.map((r) => `${r.position} ${r.name} ${r.points}`)).toEqual([
      "1 A 4",
      "2 B 4",
      "3 C 4",
      "4 E 3",
      "5 D 1",
    ]);
    expectInvariants(rows, headToHeadFirst);

    // With the default order, goal difference decides first (B has the worst GD).
    const byDefault = computeStandings([A, B, C, D, E], matches, DEFAULT_RULES);
    expect(byDefault.slice(0, 3).map((r) => r.name)).toEqual(["A", "C", "B"]);
  });

  it("after a partial head-to-head split, continues down the list (does not re-apply head-to-head)", () => {
    // Among A, B, C: A wins the mini-table on goals scored; B and C stay level in it,
    // even though B beat C directly. They then go to overall GD (level), then goals
    // scored: C 6 > B 3. Re-applying head-to-head would have put B above C.
    const matches = [
      result("A", "B", 3, 2),
      result("C", "A", 3, 2),
      result("B", "C", 1, 0),
      result("A", "D", 0, 0),
      result("B", "D", 0, 0),
      result("C", "D", 3, 3),
    ];
    const r = rules({ tieBreakers: ["points", "headToHead", "goalDifference", "goalsFor"] });
    const rows = computeStandings([A, B, C, D], matches, r);
    expect(rows.map((x) => `${x.position} ${x.name}`)).toEqual(["1 A", "2 C", "3 B", "4 D"]);
    expectInvariants(rows, r);
  });

  it("teams level after every tie-breaker share a position, ordered by name", () => {
    // Perfect cycle: everyone 3 pts, GD 0, GF 1, and the mini-table is level too.
    const matches = [result("C", "A", 1, 0), result("A", "B", 1, 0), result("B", "C", 1, 0)];
    const rows = computeStandings([C, B, A], matches, DEFAULT_RULES);
    expect(rows.map((r) => `${r.position}${r.tied ? "=" : ""} ${r.name}`)).toEqual(["1= A", "1= B", "1= C"]);
  });

  it("uses competition ranking after a shared position (1, 2=, 2=, 4)", () => {
    // B and C: 1 pt, GD −1, GF 1, and drew each other. D has not played (0 pts).
    const matches = [result("A", "B", 1, 0), result("A", "C", 1, 0), result("B", "C", 1, 1)];
    const rows = computeStandings([A, B, C, D], matches, DEFAULT_RULES);
    expect(rows.map((r) => `${r.position}${r.tied ? "=" : ""} ${r.name}`)).toEqual(["1 A", "2= B", "2= C", "4 D"]);
  });

  it("counts adjustments in the points tie-breaker", () => {
    const matches = [result("A", "C", 1, 0), result("B", "C", 1, 0)];
    const rows = computeStandings([A, B, C], matches, DEFAULT_RULES, [{ entryId: "a", points: 1, effectiveOn: "2026-01-01" }]);
    expect(rows.map((r) => r.name)).toEqual(["A", "B", "C"]);
    expect(rows[0]!.points).toBe(4);
  });
});

describe("computeStandings: form and determinism", () => {
  it("shows the last five results, most recent last, by kickoff not input order", () => {
    const day = (d: number) => `2026-03-${String(d).padStart(2, "0")}T12:00:00Z`;
    const matches = [
      result("A", "B", 0, 1, { kickoffAt: day(6) }), // L (latest)
      result("A", "B", 1, 0, { kickoffAt: day(1) }), // W (oldest, dropped)
      result("A", "B", 1, 1, { kickoffAt: day(2) }), // D
      result("A", "B", 2, 0, { kickoffAt: day(3) }), // W
      result("A", "B", 0, 0, { kickoffAt: day(4) }), // D
      result("A", "B", 0, 3, { kickoffAt: day(5) }), // L
    ];
    const rows = computeStandings([A, B], matches, DEFAULT_RULES);
    expect(rows.find((r) => r.entryId === "a")!.form).toEqual(["D", "W", "D", "L", "L"]);
    expect(rows.find((r) => r.entryId === "b")!.form).toEqual(["D", "L", "D", "W", "W"]);
  });

  it("gives identical output for shuffled input", () => {
    const entries = [A, B, C, D, E];
    const matches = [
      result("A", "B", 2, 1),
      result("C", "D", 0, 0),
      result("E", "A", 1, 1),
      result("B", "C", 3, 2),
      result("D", "E", 0, 2),
      result("C", "A", 1, 0),
    ];
    const expected = computeStandings(entries, matches, DEFAULT_RULES);
    const rng = createRng(42);
    const shuffle = <T,>(xs: T[]) => [...xs].sort(() => rng() - 0.5);
    for (let i = 0; i < 10; i++) {
      expect(computeStandings(shuffle(entries), shuffle(matches), DEFAULT_RULES)).toEqual(expected);
    }
  });
});

describe("computeStandings: invariants on random leagues (property test)", () => {
  it("holds for 200 seeded random leagues with walkovers, awarded results and adjustments", () => {
    const rng = createRng(20260815);
    const pick = (n: number) => Math.floor(rng() * n);
    for (let league = 0; league < 200; league++) {
      const size = 2 + pick(9);
      const entries = Array.from({ length: size }, (_, i) => team(`T${i}`));
      const r = rules({
        points: { win: 2 + pick(2), draw: 1, loss: 0 },
        walkover: { score: [3, 0], countGoals: rng() < 0.5 },
        tieBreakers: rng() < 0.5 ? ["points", "headToHead", "goalDifference"] : ["points", "goalDifference", "goalsFor", "headToHead"],
      });
      const matches: StandingsMatch[] = [];
      const matchCount = pick(40);
      for (let k = 0; k < matchCount; k++) {
        const h = pick(size);
        let a = pick(size);
        if (a === h) a = (a + 1) % size;
        const home = `T${h}`;
        const away = `T${a}`;
        const roll = rng();
        if (roll < 0.1) {
          matches.push(result(home, away, null, null, { outcomeType: "walkover", winnerEntryId: rng() < 0.5 ? home.toLowerCase() : away.toLowerCase() }));
        } else if (roll < 0.15) {
          matches.push(result(home, away, pick(4), pick(4), { resultState: "provisional" }));
        } else if (roll < 0.2) {
          matches.push(result(home, away, pick(4), pick(4), { outcomeType: "awarded" }));
        } else {
          const hg = pick(5);
          const ag = pick(5);
          matches.push(result(home, away, hg, ag, hg === ag && rng() < 0.3 ? { penHome: 4, penAway: 3 } : {}));
        }
      }
      const adjustments = rng() < 0.3 ? [{ entryId: "t0", points: -pick(6) - 1, effectiveOn: "2026-01-01" }] : [];
      const rows = computeStandings(entries, matches, r, adjustments);
      expect(rows).toHaveLength(size);
      expectInvariants(rows, r);
      // Positions are non-decreasing and start at 1.
      expect(rows[0]!.position).toBe(1);
      for (let i = 1; i < rows.length; i++) expect(rows[i]!.position).toBeGreaterThanOrEqual(rows[i - 1]!.position);
    }
  });
});
