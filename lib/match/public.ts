import type { MatchStatus, OutcomeType, ResultState, StandingsMatch } from "@/lib/standings";
import { formatShortDate, formatTime } from "@/lib/time";

/**
 * The public shape of a match. Scores are only ever present for matches that are
 * completed AND confirmed (CLAUDE.md rule 2); `toPublicResult` enforces this at the
 * query layer so a provisional score can never reach a public page or graphic.
 */

export type PublicTeamRef = {
  entryId: string;
  teamId: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
};

export type ScorePair = { home: number; away: number };

export type PublicResult = {
  /** Normal-time score; null for walkovers. */
  fullTime: ScorePair | null;
  halfTime: ScorePair | null;
  afterExtraTime: ScorePair | null;
  penalties: ScorePair | null;
  winnerEntryId: string | null;
  outcomeType: OutcomeType;
};

export type PublicMatch = {
  id: string;
  competition: {
    id: string;
    slug: string;
    name: string;
    streamLabel: string | null;
    area: string | null;
    type: "league" | "knockout" | "group_knockout";
  };
  roundLabel: string | null;
  roundNumber: number | null;
  kickoffAt: Date | null;
  kickoffTimeTbc: boolean;
  status: MatchStatus;
  resultState: ResultState;
  outcomeType: OutcomeType;
  home: PublicTeamRef;
  away: PublicTeamRef;
  venue: { name: string; area: string | null } | null;
  notes: string | null;
  /** Null unless the match is completed and confirmed. */
  result: PublicResult | null;
};

type RawScores = {
  status: MatchStatus;
  resultState: ResultState;
  outcomeType: OutcomeType;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  aetHomeGoals: number | null;
  aetAwayGoals: number | null;
  penHome: number | null;
  penAway: number | null;
  winnerEntryId: string | null;
};

const pair = (home: number | null, away: number | null): ScorePair | null =>
  home === null || away === null ? null : { home, away };

export function isFinal(m: { status: MatchStatus; resultState: ResultState }): boolean {
  return m.status === "completed" && m.resultState === "confirmed";
}

/** Returns the result only for completed + confirmed matches; otherwise null. */
export function toPublicResult(raw: RawScores): PublicResult | null {
  if (!isFinal(raw)) return null;
  return {
    fullTime: raw.outcomeType === "walkover" ? null : pair(raw.homeGoals, raw.awayGoals),
    halfTime: pair(raw.htHomeGoals, raw.htAwayGoals),
    afterExtraTime: pair(raw.aetHomeGoals, raw.aetAwayGoals),
    penalties: pair(raw.penHome, raw.penAway),
    winnerEntryId: raw.winnerEntryId,
    outcomeType: raw.outcomeType,
  };
}

/** Map a public match onto the standings engine's input. */
export function toStandingsMatch(m: PublicMatch): StandingsMatch {
  return {
    id: m.id,
    homeEntryId: m.home.entryId,
    awayEntryId: m.away.entryId,
    status: m.status,
    resultState: m.resultState,
    outcomeType: m.outcomeType,
    homeGoals: m.result?.fullTime?.home ?? null,
    awayGoals: m.result?.fullTime?.away ?? null,
    aetHomeGoals: m.result?.afterExtraTime?.home ?? null,
    aetAwayGoals: m.result?.afterExtraTime?.away ?? null,
    penHome: m.result?.penalties?.home ?? null,
    penAway: m.result?.penalties?.away ?? null,
    winnerEntryId: m.result?.winnerEntryId ?? null,
    kickoffAt: m.kickoffAt,
  };
}

export type DisplayState = "final" | "pending" | "scheduled" | "postponed" | "cancelled" | "abandoned";

export function displayState(m: Pick<PublicMatch, "status" | "resultState">): DisplayState {
  if (m.status === "completed") return m.resultState === "confirmed" ? "final" : "pending";
  return m.status;
}

export const STATE_LABEL: Record<DisplayState, string> = {
  final: "Full time",
  pending: "Result pending",
  scheduled: "Scheduled",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

/** "Sat, 15 Aug · 14:00", "Sat, 15 Aug · Time TBC" or "Date TBC". */
export function formatKickoff(m: Pick<PublicMatch, "kickoffAt" | "kickoffTimeTbc">): string {
  if (!m.kickoffAt) return "Date TBC";
  const date = formatShortDate(m.kickoffAt);
  return m.kickoffTimeTbc ? `${date} · Time TBC` : `${date} · ${formatTime(m.kickoffAt)}`;
}

/** Main score text, e.g. "2–1" or "W/O". Null when there is no public result. */
export function mainScore(result: PublicResult | null): string | null {
  if (!result) return null;
  if (result.outcomeType === "walkover") return "W/O";
  const s = result.afterExtraTime ?? result.fullTime;
  return s ? `${s.home}–${s.away}` : null;
}

/** Secondary lines under a score: "AET", "Pens 4–5", "HT 1–0", "Awarded", "Walkover". */
export function scoreDetails(result: PublicResult | null): string[] {
  if (!result) return [];
  const lines: string[] = [];
  if (result.outcomeType === "walkover") lines.push("Walkover");
  if (result.outcomeType === "awarded") lines.push("Awarded");
  if (result.afterExtraTime) lines.push(`After extra time (90′: ${result.fullTime?.home ?? "–"}–${result.fullTime?.away ?? "–"})`);
  if (result.penalties) lines.push(`Penalties ${result.penalties.home}–${result.penalties.away}`);
  if (result.halfTime) lines.push(`HT ${result.halfTime.home}–${result.halfTime.away}`);
  return lines;
}

/** "Stream A · Tseki" style suffix for competition names. */
export function competitionSubtitle(c: { streamLabel: string | null; area: string | null }): string | null {
  const parts = [c.streamLabel, c.area].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(" · ") : null;
}
