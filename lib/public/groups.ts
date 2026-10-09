import type { PublicMatch, PublicTeamRef } from "@/lib/match/public";
import type { CompetitionRules } from "@/lib/rules";
import type { StandingsAdjustment } from "@/lib/standings";
import { standingsFor, type TableRow } from "./views";

/**
 * Groups + knockout competitions (pure). Each group's table is computed exactly like a league
 * table, from the confirmed group-stage matches between that group's teams only.
 */

export type GroupTable = { label: string; rows: TableRow[] };

export const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export function groupTables(data: {
  entries: PublicTeamRef[];
  matches: PublicMatch[];
  adjustments: StandingsAdjustment[];
  competition: { rules: CompetitionRules };
}): GroupTable[] {
  const labels = [...new Set(data.entries.map((e) => e.groupLabel).filter((g): g is string => Boolean(g)))].sort();
  return labels.map((label) => {
    const entries = data.entries.filter((e) => e.groupLabel === label);
    const ids = new Set(entries.map((e) => e.entryId));
    return {
      label,
      rows: standingsFor({
        entries,
        matches: data.matches.filter((m) => m.stage === "group" && ids.has(m.home.entryId) && ids.has(m.away.entryId)),
        adjustments: data.adjustments.filter((a) => ids.has(a.entryId)),
        competition: data.competition,
      }),
    };
  });
}

/** Knockout-stage matches (anything not marked as a group match). */
export function knockoutMatches(matches: PublicMatch[]): PublicMatch[] {
  return matches.filter((m) => m.stage !== "group");
}

/** Why a fixture's stage doesn't fit the teams' groups, or null. */
export function stageProblem(
  stage: "group" | "knockout" | null,
  homeGroup: string | null | undefined,
  awayGroup: string | null | undefined,
): string | null {
  if (stage !== "group") return null;
  if (!homeGroup || !awayGroup) return "Put both teams in a group first (Setup → the competition → Groups).";
  if (homeGroup !== awayGroup) return `A group match needs two teams from the same group (these are in ${homeGroup} and ${awayGroup}).`;
  return null;
}
