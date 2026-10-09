import Link from "next/link";
import type { LatestResult } from "@/lib/db/queries";
import { formatShortDate } from "@/lib/time";

/** Homepage strip of the newest confirmed results; swipe sideways on a phone. */
export function LatestResults({ results }: { results: LatestResult[] }) {
  if (!results.length) return null;
  return (
    <section aria-labelledby="latest-heading" className="mx-auto mt-10 max-w-3xl">
      <h2 id="latest-heading" className="px-4 font-display text-2xl font-bold uppercase tracking-wide">
        Latest results
      </h2>
      <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {results.map((r) => (
          <li key={r.matchId} className="w-64 shrink-0 snap-start">
            <Link
              href={`/${r.orgSlug}/match/${r.matchId}`}
              className="block h-full rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 hover:ring-black/20"
            >
              <span className="block truncate text-xs font-semibold uppercase tracking-wide text-emerald-800">
                {r.competitionName}
              </span>
              <span className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{r.home}</span>
                  <span className="block truncate font-semibold">{r.away}</span>
                </span>
                <span className="rounded-lg bg-emerald-900 px-2 py-1 font-display text-2xl font-bold tabular-nums text-white">
                  {r.score}
                </span>
              </span>
              <span className="mt-2 block truncate text-xs text-muted">
                {[formatShortDate(r.kickoffAt), r.note, r.orgName].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
