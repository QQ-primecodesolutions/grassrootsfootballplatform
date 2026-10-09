import Link from "next/link";
import type { AdminMatch } from "@/lib/db/queries/admin";
import { displayState, formatKickoff } from "@/lib/match/public";
import { StatusBadge } from "@/components/public/StatusBadge";

/** Admin sees the stored score even when provisional (clearly badged). */
function adminScore(m: AdminMatch): string | null {
  if (m.status !== "completed") return null;
  if (m.outcomeType === "walkover") return "W/O";
  const h = m.aetHomeGoals ?? m.homeGoals;
  const a = m.aetAwayGoals ?? m.awayGoals;
  return h === null || a === null ? null : `${h}–${a}`;
}

export function AdminMatchRow({
  match: m,
  showDate = true,
  note = null,
}: {
  match: AdminMatch;
  showDate?: boolean;
  /** An extra line, e.g. "Entered by Thabo". */
  note?: string | null;
}) {
  const score = adminScore(m);
  const state = displayState(m);
  return (
    <li>
      <Link href={`/admin/results/${m.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-gray-500">
            {[m.competitionName, m.streamLabel, m.roundLabel, showDate ? formatKickoff(m) : null].filter(Boolean).join(" · ")}
          </p>
          <p className="truncate font-semibold">{m.home.name}</p>
          <p className="truncate font-semibold">{m.away.name}</p>
          {note ? <p className="truncate text-xs font-semibold text-amber-800">{note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {score ? (
            <span
              className={`rounded px-2 py-1 font-display text-lg font-bold tabular-nums ${
                state === "final" ? "bg-gray-900 text-white" : "bg-amber-100 text-amber-900"
              }`}
            >
              {score}
            </span>
          ) : null}
          {state === "scheduled" ? (
            <span className="text-sm font-semibold text-gray-700">Enter result ›</span>
          ) : (
            <StatusBadge state={state} />
          )}
        </div>
      </Link>
    </li>
  );
}

export function AdminList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-black/5 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">{children}</ul>;
}
