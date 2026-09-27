import { expect } from "vitest";
import { parseRules, type CompetitionRules } from "@/lib/rules";
import { checkTableInvariants, type StandingRow, type StandingsEntry, type StandingsMatch } from "@/lib/standings";

export const team = (name: string): StandingsEntry => ({ entryId: name.toLowerCase(), name });

let seq = 0;

/** A completed, confirmed match. Kickoffs default to consecutive days in input order. */
export function result(
  home: string,
  away: string,
  homeGoals: number | null,
  awayGoals: number | null,
  extra: Partial<StandingsMatch> = {},
): StandingsMatch {
  seq++;
  return {
    id: `m${String(seq).padStart(4, "0")}`,
    homeEntryId: home.toLowerCase(),
    awayEntryId: away.toLowerCase(),
    status: "completed",
    resultState: "confirmed",
    outcomeType: "normal",
    homeGoals,
    awayGoals,
    winnerEntryId: null,
    kickoffAt: new Date(Date.UTC(2026, 0, 1) + seq * 86_400_000),
    ...extra,
  };
}

export function rules(overrides: Record<string, unknown> = {}): CompetitionRules {
  return parseRules(overrides);
}

/** Compact view of a table for readable assertions: "pos name P W D L GF GA Pts". */
export function summary(rows: StandingRow[]): string[] {
  return rows.map(
    (r) =>
      `${r.position}${r.tied ? "=" : ""} ${r.name} ${r.played} ${r.won} ${r.drawn} ${r.lost} ${r.goalsFor} ${r.goalsAgainst} ${r.points}`,
  );
}

/** Every computed table must satisfy the invariants. */
export function expectInvariants(rows: StandingRow[], r: CompetitionRules) {
  const check = checkTableInvariants(rows, r);
  expect(check.errors).toEqual([]);
}
