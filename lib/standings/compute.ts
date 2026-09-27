import type { CompetitionRules, TieBreaker } from "@/lib/rules";
import { sastDateKey } from "@/lib/time";
import type {
  FormResult,
  StandingRow,
  StandingsAdjustment,
  StandingsEntry,
  StandingsMatch,
  StandingsOptions,
} from "./types";

/** A counted match reduced to what the table needs. */
type ResolvedMatch = {
  id: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** Who won; null for a draw. Independent of goals for walkovers without goals. */
  winner: string | null;
  kickoffMs: number;
};

type Tally = {
  entry: StandingsEntry;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  adjustment: number;
  points: number;
  results: { kickoffMs: number; matchId: string; result: FormResult }[];
};

const FORM_LENGTH = 5;

function toMs(value: Date | string | null): number {
  if (value === null) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Only completed AND confirmed matches count. */
export function isCountedMatch(match: StandingsMatch): boolean {
  return match.status === "completed" && match.resultState === "confirmed";
}

/**
 * Turn a counted match into goals + winner, applying competition rules.
 * - normal / awarded: goals after extra time if played, else normal time. Awarded
 *   results use the entered score (walkover `countGoals` does not apply to them).
 * - walkover: the configured score for the winner, or 0–0 in goals when
 *   `countGoals` is false (the result still counts as a win/loss).
 * - Penalty shootouts never change goals or the result.
 */
function resolveMatch(match: StandingsMatch, rules: CompetitionRules): ResolvedMatch {
  const kickoffMs = toMs(match.kickoffAt);
  if (Number.isNaN(kickoffMs)) throw new Error(`Match ${match.id} is completed but has no valid kickoff time`);
  const base = { id: match.id, home: match.homeEntryId, away: match.awayEntryId, kickoffMs };

  if (match.outcomeType === "walkover") {
    const winner = match.winnerEntryId;
    if (winner !== match.homeEntryId && winner !== match.awayEntryId) {
      throw new Error(`Walkover ${match.id} needs a winner who is one of the two teams`);
    }
    const [winGoals, loseGoals] = rules.walkover.countGoals ? rules.walkover.score : [0, 0];
    const homeWon = winner === match.homeEntryId;
    return {
      ...base,
      homeGoals: homeWon ? winGoals : loseGoals,
      awayGoals: homeWon ? loseGoals : winGoals,
      winner,
    };
  }

  const homeGoals = match.aetHomeGoals ?? match.homeGoals;
  const awayGoals = match.aetAwayGoals ?? match.awayGoals;
  if (homeGoals === null || awayGoals === null) {
    throw new Error(`Match ${match.id} is completed but has no score`);
  }
  const winner = homeGoals > awayGoals ? match.homeEntryId : awayGoals > homeGoals ? match.awayEntryId : null;
  return { ...base, homeGoals, awayGoals, winner };
}

function newTally(entry: StandingsEntry): Tally {
  return {
    entry,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    adjustment: 0,
    points: 0,
    results: [],
  };
}

function record(tally: Tally, goalsFor: number, goalsAgainst: number, result: FormResult, match: ResolvedMatch) {
  tally.played++;
  tally.goalsFor += goalsFor;
  tally.goalsAgainst += goalsAgainst;
  if (result === "W") tally.won++;
  else if (result === "D") tally.drawn++;
  else tally.lost++;
  tally.results.push({ kickoffMs: match.kickoffMs, matchId: match.id, result });
}

function resultFor(match: ResolvedMatch, entryId: string): FormResult {
  if (match.winner === null) return "D";
  return match.winner === entryId ? "W" : "L";
}

/** Tally P/W/D/L/GF/GA for the given entries over the given matches. */
function tallyMatches(entries: StandingsEntry[], matches: ResolvedMatch[]): Map<string, Tally> {
  const tallies = new Map(entries.map((e) => [e.entryId, newTally(e)]));
  for (const m of matches) {
    const home = tallies.get(m.home);
    const away = tallies.get(m.away);
    if (!home || !away) continue;
    record(home, m.homeGoals, m.awayGoals, resultFor(m, m.home), m);
    record(away, m.awayGoals, m.homeGoals, resultFor(m, m.away), m);
  }
  return tallies;
}

function basePoints(t: Tally, rules: CompetitionRules): number {
  return t.won * rules.points.win + t.drawn * rules.points.draw + t.lost * rules.points.loss;
}

/**
 * Split a group into ordered subgroups by a numeric key tuple (all descending).
 * Teams with identical keys stay together.
 */
function partitionBy(group: Tally[], key: (t: Tally) => number[]): Tally[][] {
  const keyed = group.map((t) => ({ t, k: key(t) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < a.k.length; i++) {
      const diff = b.k[i]! - a.k[i]!;
      if (diff !== 0) return diff;
    }
    return 0;
  });
  const out: Tally[][] = [];
  let prev: number[] | null = null;
  for (const { t, k } of keyed) {
    if (prev && k.every((v, i) => v === prev![i])) out[out.length - 1]!.push(t);
    else out.push([t]);
    prev = k;
  }
  return out;
}

/**
 * Head-to-head: a mini-table from counted matches between the tied teams only,
 * ranked by points, then goal difference, then goals scored (PLAN.md decision 2;
 * an assumption until the organiser confirms).
 */
function headToHead(group: Tally[], matches: ResolvedMatch[], rules: CompetitionRules): Tally[][] {
  const ids = new Set(group.map((t) => t.entry.entryId));
  const between = matches.filter((m) => ids.has(m.home) && ids.has(m.away));
  const mini = tallyMatches(
    group.map((t) => t.entry),
    between,
  );
  return partitionBy(group, (t) => {
    const m = mini.get(t.entry.entryId)!;
    return [basePoints(m, rules), m.goalsFor - m.goalsAgainst, m.goalsFor];
  });
}

/**
 * Apply tie-breakers in order. Returns ordered groups; a group with more than one
 * team is still level after every tie-breaker and shares a position.
 * Teams still tied after a criterion continue with the NEXT criterion (head-to-head
 * is not re-applied to a smaller subgroup — PLAN.md decision 2).
 */
function rankGroup(
  group: Tally[],
  criteria: readonly TieBreaker[],
  index: number,
  matches: ResolvedMatch[],
  rules: CompetitionRules,
): Tally[][] {
  if (group.length <= 1 || index >= criteria.length) return [group];
  const criterion = criteria[index]!;

  let parts: Tally[][];
  switch (criterion) {
    case "points":
      parts = partitionBy(group, (t) => [t.points]);
      break;
    case "goalDifference":
      parts = partitionBy(group, (t) => [t.goalsFor - t.goalsAgainst]);
      break;
    case "goalsFor":
      parts = partitionBy(group, (t) => [t.goalsFor]);
      break;
    case "wins":
      parts = partitionBy(group, (t) => [t.won]);
      break;
    case "headToHead":
      parts = headToHead(group, matches, rules);
      break;
  }
  return parts.flatMap((part) => rankGroup(part, criteria, index + 1, matches, rules));
}

const byDisplayName = (a: Tally, b: Tally) =>
  a.entry.name.localeCompare(b.entry.name, "en") || (a.entry.entryId < b.entry.entryId ? -1 : 1);

/**
 * Compute a league table from results.
 *
 * Only `completed` + `confirmed` matches between registered entries count.
 * Output is deterministic: it does not depend on input order.
 */
export function computeStandings(
  entries: StandingsEntry[],
  matches: StandingsMatch[],
  rules: CompetitionRules,
  adjustments: StandingsAdjustment[] = [],
  options: StandingsOptions = {},
): StandingRow[] {
  const entryIds = new Set(entries.map((e) => e.entryId));
  if (entryIds.size !== entries.length) throw new Error("Duplicate entryId in entries");

  const counted = matches
    .filter(isCountedMatch)
    .filter((m) => entryIds.has(m.homeEntryId) && entryIds.has(m.awayEntryId))
    .map((m) => resolveMatch(m, rules))
    .filter((m) => options.asOf === undefined || sastDateKey(new Date(m.kickoffMs)) <= options.asOf)
    // Stable, input-order-independent processing.
    .sort((a, b) => a.kickoffMs - b.kickoffMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const tallies = tallyMatches(entries, counted);

  for (const adj of adjustments) {
    if (options.asOf !== undefined && adj.effectiveOn > options.asOf) continue;
    const t = tallies.get(adj.entryId);
    if (t) t.adjustment += adj.points;
  }
  for (const t of tallies.values()) t.points = basePoints(t, rules) + t.adjustment;

  const groups = rankGroup([...tallies.values()], rules.tieBreakers, 0, counted, rules);

  const rows: StandingRow[] = [];
  let position = 1;
  for (const group of groups) {
    const tied = group.length > 1;
    for (const t of [...group].sort(byDisplayName)) {
      rows.push({
        position,
        tied,
        entryId: t.entry.entryId,
        name: t.entry.name,
        ...(t.entry.shortName !== undefined ? { shortName: t.entry.shortName } : {}),
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        goalDifference: t.goalsFor - t.goalsAgainst,
        adjustment: t.adjustment,
        points: t.points,
        form: t.results.slice(-FORM_LENGTH).map((r) => r.result),
      });
    }
    position += group.length;
  }
  return rows;
}
