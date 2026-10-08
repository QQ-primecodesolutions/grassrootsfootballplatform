import type { AdminMatch } from "@/lib/db/queries/admin";
import { sastDateKey } from "@/lib/time";

export type AdminMatchGroups = {
  /** Kick-off today (SAST), any state. */
  today: AdminMatch[];
  /** Before today, not yet confirmed and not postponed/cancelled: results to chase. */
  needsResult: AdminMatch[];
  /** The next `upcomingDays` days, soonest first. */
  upcoming: AdminMatch[];
  /** Confirmed in the last `recentDays` days, newest first. */
  recent: AdminMatch[];
};

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const isConfirmed = (m: AdminMatch) => m.status === "completed" && m.resultState === "confirmed";

/** Pure: `today` is a SAST date key (YYYY-MM-DD) supplied by the caller. */
export function groupAdminMatches(
  matches: AdminMatch[],
  today: string,
  opts: { upcomingDays?: number; recentDays?: number } = {},
): AdminMatchGroups {
  const upcomingUntil = addDays(today, opts.upcomingDays ?? 7);
  const recentFrom = addDays(today, -(opts.recentDays ?? 14));
  const withDate = matches.filter((m) => m.kickoffAt).map((m) => ({ m, day: sastDateKey(m.kickoffAt!) }));

  return {
    today: withDate.filter((x) => x.day === today).map((x) => x.m),
    needsResult: withDate
      .filter((x) => x.day < today && !isConfirmed(x.m) && x.m.status !== "postponed" && x.m.status !== "cancelled")
      .map((x) => x.m),
    upcoming: withDate.filter((x) => x.day > today && x.day <= upcomingUntil).map((x) => x.m),
    recent: withDate
      .filter((x) => x.day < today && x.day >= recentFrom && isConfirmed(x.m))
      .map((x) => x.m)
      .reverse(),
  };
}

export type MatchDay = {
  competitionId: string;
  competitionName: string;
  streamLabel: string | null;
  /** SAST date key */
  date: string;
  matches: AdminMatch[];
};

/**
 * Pure: scheduled fixtures from `today` (SAST date key) onwards, grouped by competition and
 * day, soonest first. These are the match days with a fixtures graphic to share.
 */
export function upcomingMatchDays(matches: AdminMatch[], today: string, limit = 6): MatchDay[] {
  const days = new Map<string, MatchDay>();
  const sorted = matches
    .filter((m) => m.status === "scheduled" && m.kickoffAt && sastDateKey(m.kickoffAt) >= today)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  for (const m of sorted) {
    const date = sastDateKey(m.kickoffAt!);
    const key = `${date}|${m.competitionId}`;
    let day = days.get(key);
    if (!day) {
      day = { competitionId: m.competitionId, competitionName: m.competitionName, streamLabel: m.streamLabel, date, matches: [] };
      days.set(key, day);
    }
    day.matches.push(m);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}
