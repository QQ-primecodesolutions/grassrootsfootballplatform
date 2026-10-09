import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentAdmin } from "@/lib/auth";
import { COMPETITION_TYPE_LABELS } from "@/lib/competitions/input";
import { listCompetitionsForSetup } from "@/lib/db/queries/setup";

export const metadata: Metadata = { title: "Competitions" };

export default function CompetitionsPage({ searchParams }: PageProps<"/admin/competitions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Competitions searchParams={searchParams} />
    </Suspense>
  );
}

async function Competitions({ searchParams }: Pick<PageProps<"/admin/competitions">, "searchParams">) {
  const [{ scope, org }, query] = await Promise.all([getCurrentAdmin(), searchParams]);
  const competitions = await listCompetitionsForSetup(scope);

  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Competitions</h1>
      <p className="text-sm text-gray-600">Leagues and cups run by {org.name}, with their teams and rules.</p>
      {query.deleted ? (
        <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-900 ring-1 ring-green-200">
          Competition deleted.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/admin/competitions/new" className="rounded-lg bg-gray-900 px-3 py-4 text-center font-semibold text-white">
          + New competition
        </Link>
        <Link href="/admin/teams" className="rounded-lg bg-white px-3 py-4 text-center font-semibold shadow-sm ring-1 ring-black/10">
          All teams
        </Link>
        <Link href="/admin/people" className="col-span-2 rounded-lg bg-white px-3 py-3 text-center font-semibold shadow-sm ring-1 ring-black/10">
          People &amp; scorers
        </Link>
      </div>

      {competitions.length ? (
        <ul className="mt-4 divide-y divide-black/5 rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          {competitions.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/competitions/${c.id}`} className="block px-3 py-3 hover:bg-gray-50">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {c.name}
                    {c.streamLabel ? ` · ${c.streamLabel}` : ""}
                  </span>
                  {c.isFeatured ? (
                    <span className="rounded bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">Featured</span>
                  ) : null}
                </span>
                <span className="block text-sm text-gray-600">
                  {COMPETITION_TYPE_LABELS[c.type]} · {c.seasonName} · {c.entryCount} team{c.entryCount === 1 ? "" : "s"} ·{" "}
                  {c.matchCount} match{c.matchCount === 1 ? "" : "es"}
                  {(c.type === "league" || c.type === "group_knockout") && !c.rulesConfirmed ? (
                    <span className="font-semibold text-amber-800"> · rules not confirmed</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg bg-white p-4 text-sm shadow-sm ring-1 ring-black/5">
          No competitions yet. Create one, add its teams, then add fixtures.
        </p>
      )}
    </>
  );
}
