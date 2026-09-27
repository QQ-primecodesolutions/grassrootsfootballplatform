import { isFinal, toStandingsMatch, type PublicMatch, type PublicTeamRef } from "@/lib/match/public";
import type { CompetitionRules } from "@/lib/rules";
import { computeStandings, type StandingRow, type StandingsAdjustment } from "@/lib/standings";
import { formatLongDate, sastDateKey } from "@/lib/time";

/** Pure view helpers for public pages (no DB, no clock). */

export type TableRow = StandingRow & { team: PublicTeamRef };

export function standingsFor(
  data: {
    entries: PublicTeamRef[];
    matches: PublicMatch[];
    adjustments: StandingsAdjustment[];
    competition: { rules: CompetitionRules };
  },
  options: { asOf?: string } = {},
): TableRow[] {
  const byEntry = new Map(data.entries.map((e) => [e.entryId, e]));
  const rows = computeStandings(
    data.entries.map((e) => ({ entryId: e.entryId, name: e.name, shortName: e.shortName })),
    data.matches.map(toStandingsMatch),
    data.competition.rules,
    data.adjustments,
    options,
  );
  return rows.map((r) => ({ ...r, team: byEntry.get(r.entryId)! }));
}

const kickoffMs = (m: PublicMatch) => m.kickoffAt?.getTime() ?? Number.POSITIVE_INFINITY;

/** Everything without a final result: scheduled, postponed, pending, abandoned, cancelled. Soonest first; date TBC last. */
export function fixturesOf(matches: PublicMatch[]): PublicMatch[] {
  return matches.filter((m) => !isFinal(m)).sort((a, b) => kickoffMs(a) - kickoffMs(b) || a.id.localeCompare(b.id));
}

/** Upcoming = scheduled or postponed only (for compact "next up" lists). */
export function upcomingOf(matches: PublicMatch[]): PublicMatch[] {
  return fixturesOf(matches).filter((m) => m.status === "scheduled" || m.status === "postponed");
}

/** Confirmed results, most recent first. */
export function resultsOf(matches: PublicMatch[]): PublicMatch[] {
  return matches.filter(isFinal).sort((a, b) => kickoffMs(b) - kickoffMs(a) || a.id.localeCompare(b.id));
}

export type DateGroup = { key: string; label: string; matches: PublicMatch[] };

/** Group matches by SAST calendar date, keeping the input order. */
export function groupByDate(matches: PublicMatch[]): DateGroup[] {
  const groups: DateGroup[] = [];
  const index = new Map<string, DateGroup>();
  for (const m of matches) {
    const key = m.kickoffAt ? sastDateKey(m.kickoffAt) : "tbc";
    let g = index.get(key);
    if (!g) {
      g = { key, label: m.kickoffAt ? formatLongDate(m.kickoffAt) : "Date to be confirmed", matches: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.matches.push(m);
  }
  return groups;
}

/** Group by round label (for knockout competitions), keeping the input order. */
export function groupByRound(matches: PublicMatch[]): { label: string; matches: PublicMatch[] }[] {
  const groups = new Map<string, PublicMatch[]>();
  for (const m of matches) {
    const label = m.roundLabel ?? "Matches";
    groups.set(label, [...(groups.get(label) ?? []), m]);
  }
  return [...groups].map(([label, ms]) => ({ label, matches: ms }));
}

export function teamMatches(matches: PublicMatch[], teamId: string): PublicMatch[] {
  return matches.filter((m) => m.home.teamId === teamId || m.away.teamId === teamId);
}

