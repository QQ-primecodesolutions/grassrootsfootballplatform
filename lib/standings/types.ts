/**
 * Standings engine types. The engine is pure: no database, no clock, no I/O.
 * Callers map DB rows onto these shapes.
 */

export type MatchStatus = "scheduled" | "postponed" | "cancelled" | "abandoned" | "completed";
export type OutcomeType = "normal" | "walkover" | "awarded";
export type ResultState = "provisional" | "confirmed";
export type FormResult = "W" | "D" | "L";

/** A team registered in the competition. */
export type StandingsEntry = {
  entryId: string;
  name: string;
  shortName?: string;
};

export type StandingsMatch = {
  id: string;
  homeEntryId: string;
  awayEntryId: string;
  status: MatchStatus;
  resultState: ResultState;
  outcomeType: OutcomeType;
  /** Score at the end of normal time. Null for walkovers and unplayed matches. */
  homeGoals: number | null;
  awayGoals: number | null;
  /** Cumulative score after extra time, if played. Used for goals when present. */
  aetHomeGoals?: number | null;
  aetAwayGoals?: number | null;
  /** Shootout scores are accepted but never affect goals or points. */
  penHome?: number | null;
  penAway?: number | null;
  /** Required for walkovers. */
  winnerEntryId: string | null;
  /** Used for form order and `asOf` filtering. Required for completed matches. */
  kickoffAt: Date | string | null;
};

export type StandingsAdjustment = {
  entryId: string;
  points: number;
  reason?: string;
  /** YYYY-MM-DD (SAST). */
  effectiveOn: string;
};

export type StandingsOptions = {
  /** Only count matches kicking off on or before this SAST date (YYYY-MM-DD), inclusive. */
  asOf?: string;
};

export type StandingRow = {
  /** Competition ranking: teams level after every tie-breaker share a position (1, 2, 2, 4). */
  position: number;
  /** True when this row shares its position with another team. */
  tied: boolean;
  entryId: string;
  name: string;
  shortName?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Sum of points adjustments (negative for deductions). */
  adjustment: number;
  /** Includes adjustments. */
  points: number;
  /** Last 5 counted results, most recent last. */
  form: FormResult[];
};
