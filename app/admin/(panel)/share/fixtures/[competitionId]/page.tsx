import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GraphicShare } from "@/components/admin/GraphicShare";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { upcomingMatchDays } from "@/lib/admin/match-lists";
import { fixturesShare } from "@/lib/admin/share-links";
import { getCurrentAdmin } from "@/lib/auth";
import { listAdminMatches } from "@/lib/db/queries/admin";
import { siteUrl } from "@/lib/env";
import { formatLongDate, formatTime, sastDateKey, sastDateTime, todaySast } from "@/lib/time";

export const metadata: Metadata = { title: "Share fixtures" };

export default function ShareFixturesPage({ params, searchParams }: PageProps<"/admin/share/fixtures/[competitionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShareFixtures params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ShareFixtures({
  params,
  searchParams,
}: Pick<PageProps<"/admin/share/fixtures/[competitionId]">, "params" | "searchParams">) {
  const [{ competitionId }, query, { scope, org }] = await Promise.all([params, searchParams, getCurrentAdmin()]);
  const all = (await listAdminMatches(scope)).filter((m) => m.competitionId === competitionId);
  const days = upcomingMatchDays(all, todaySast(), 20);
  const requested = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : null;
  const date = requested ?? days[0]?.date ?? null;
  const matches = date
    ? all
        .filter((m) => m.status === "scheduled" && m.kickoffAt && sastDateKey(m.kickoffAt) === date)
        .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime())
    : [];
  const share = date && matches.length ? await fixturesShare(org, matches, date, siteUrl()) : null;
  const name = all[0] ? [all[0].competitionName, all[0].streamLabel].filter(Boolean).join(" · ") : "This competition";

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm font-semibold text-gray-600">
        ← Home
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Share fixtures</h1>
        <p className="text-sm text-gray-600">
          {name}
          {date ? ` · ${formatLongDate(sastDateTime(date, "12:00"))}` : ""}
        </p>
      </div>

      {share ? (
        <>
          <ul className="divide-y divide-black/5 rounded-lg bg-white text-sm shadow-sm ring-1 ring-black/5">
            {matches.map((m) => (
              <li key={m.id}>
                {/* The match page has the single-match card ("Announce this match"). */}
                <Link href={`/admin/results/${m.id}`} className="flex gap-3 px-3 py-2 hover:bg-gray-50">
                  <span className="w-12 shrink-0 font-semibold tabular-nums">
                    {m.kickoffAt && !m.kickoffTimeTbc ? formatTime(m.kickoffAt) : "TBC"}
                  </span>
                  <span className="min-w-0 flex-1">
                    {m.home.name} vs {m.away.name}
                    {m.roundLabel || m.venueName ? (
                      <span className="block text-xs text-gray-600">{[m.roundLabel, m.venueName].filter(Boolean).join(" · ")}</span>
                    ) : null}
                  </span>
                  <span className="self-center text-xs font-semibold text-gray-600">Match ›</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-600">Tap a match to share it on its own.</p>
          <GraphicShare title="Share these fixtures" graphics={share.graphics} text={share.text} fileName={`fixtures-${date}.png`} />
        </>
      ) : (
        <p className="rounded-lg bg-white p-4 text-sm shadow-sm ring-1 ring-black/5">
          No scheduled fixtures {date ? "on this day" : "coming up"}. Add fixtures first.
        </p>
      )}

      {days.length > 1 ? (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold uppercase">Other match days</h2>
          <ul className="grid grid-cols-2 gap-2">
            {days
              .filter((d) => d.date !== date)
              .map((d) => (
                <li key={d.date}>
                  <Link
                    href={`/admin/share/fixtures/${competitionId}?date=${d.date}`}
                    className="block rounded-lg bg-white px-3 py-3 text-sm font-semibold shadow-sm ring-1 ring-black/10"
                  >
                    {formatLongDate(sastDateTime(d.date, "12:00"))}
                    <span className="block text-xs font-normal text-gray-600">
                      {d.matches.length} fixture{d.matches.length === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
