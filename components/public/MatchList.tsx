import Link from "next/link";
import { displayState, formatKickoff, mainScore, type PublicMatch } from "@/lib/match/public";
import { formatShortDate, formatTime } from "@/lib/time";
import { StatusBadge } from "./StatusBadge";

type RowProps = {
  orgSlug: string;
  match: PublicMatch;
  /** Show the competition name (lists that mix competitions). */
  showCompetition?: boolean;
  /** Show the date in the row (lists not grouped by date). */
  showDate?: boolean;
  /** Show the round label (off when the list is already grouped by round). */
  showRound?: boolean;
};

/** One match: teams stacked, score or kickoff on the right. The whole row is a large tap target. */
export function MatchRow({ orgSlug, match: m, showCompetition = false, showDate = false, showRound = true }: RowProps) {
  const state = displayState(m);
  const score = mainScore(m.result);
  const homeWon = m.result?.winnerEntryId === m.home.entryId;
  const awayWon = m.result?.winnerEntryId === m.away.entryId;
  const when = showDate
    ? formatKickoff(m)
    : m.kickoffAt && !m.kickoffTimeTbc
      ? formatTime(m.kickoffAt)
      : "Time TBC";
  // With a score on the right, the date moves into the caption line.
  const caption = [
    showCompetition ? m.competition.name : null,
    showRound ? m.roundLabel : null,
    showDate && score && m.kickoffAt ? formatShortDate(m.kickoffAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/${orgSlug}/match/${m.id}`}
        className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.03] focus-visible:bg-black/[0.03]"
      >
        <div className="min-w-0 flex-1">
          {caption ? <p className="truncate text-xs text-muted">{caption}</p> : null}
          <p className={`truncate ${homeWon ? "font-bold" : "font-medium"}`}>{m.home.name}</p>
          <p className={`truncate ${awayWon ? "font-bold" : "font-medium"}`}>{m.away.name}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {score ? (
            <span className="rounded bg-brand px-2 py-1 font-display text-lg font-bold tabular-nums text-on-brand">
              {score}
            </span>
          ) : (
            <span className="text-sm font-semibold tabular-nums">{when}</span>
          )}
          {state !== "final" && state !== "scheduled" ? <StatusBadge state={state} /> : null}
          {state === "final" && (m.result?.penalties || m.result?.afterExtraTime) ? (
            <span className="text-[0.7rem] text-muted">
              {m.result?.penalties ? `Pens ${m.result.penalties.home}–${m.result.penalties.away}` : "AET"}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function MatchList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-black/5 overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-black/5">
      {children}
    </ul>
  );
}
