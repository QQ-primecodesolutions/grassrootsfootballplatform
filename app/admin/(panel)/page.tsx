import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminList, AdminMatchRow } from "@/components/admin/AdminMatchRow";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { groupAdminMatches } from "@/lib/admin/match-lists";
import { getCurrentAdmin } from "@/lib/auth";
import { listAdminMatches, listCompetitionsForAdmin } from "@/lib/db/queries/admin";
import { RULE_ASSUMPTIONS } from "@/lib/rules";
import { todaySast } from "@/lib/time";

export const metadata: Metadata = { title: "Home" };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const { scope, org } = await getCurrentAdmin();
  const [competitions, matches] = await Promise.all([listCompetitionsForAdmin(scope), listAdminMatches(scope)]);
  const groups = groupAdminMatches(matches, todaySast());

  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">{org.name}</h1>
      <p className="text-sm text-gray-600">
        <Link href={`/${org.slug}`} className="underline">
          View public site
        </Link>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/admin/results" className="rounded-lg bg-gray-900 px-3 py-4 text-center font-semibold text-white">
          Enter a result
        </Link>
        <Link href="/admin/fixtures/paste" className="rounded-lg bg-white px-3 py-4 text-center font-semibold shadow-sm ring-1 ring-black/10">
          Paste fixtures
        </Link>
        <Link href="/admin/fixtures/new" className="rounded-lg bg-white px-3 py-4 text-center font-semibold shadow-sm ring-1 ring-black/10">
          Add a fixture
        </Link>
        <Link href="/admin/teams" className="rounded-lg bg-white px-3 py-4 text-center font-semibold shadow-sm ring-1 ring-black/10">
          Teams
        </Link>
      </div>

      {competitions.map((c) =>
        c.expectedMatchCount ? (
          <p key={c.id} className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <strong>
              {c.confirmedCount} of {c.expectedMatchCount}
            </strong>{" "}
            season results entered for {c.name}
            {c.streamLabel ? ` · ${c.streamLabel}` : ""}. The public table only counts confirmed results.
          </p>
        ) : null,
      )}

      <h2 className="mt-6 mb-2 font-display text-lg font-bold uppercase">Today</h2>
      {groups.today.length ? (
        <AdminList>
          {groups.today.map((m) => (
            <AdminMatchRow key={m.id} match={m} showDate={false} />
          ))}
        </AdminList>
      ) : (
        <p className="text-sm text-gray-600">No matches today.</p>
      )}

      {groups.needsResult.length ? (
        <>
          <h2 className="mt-6 mb-2 font-display text-lg font-bold uppercase">Needs a result</h2>
          <AdminList>
            {groups.needsResult.map((m) => (
              <AdminMatchRow key={m.id} match={m} />
            ))}
          </AdminList>
        </>
      ) : null}

      <details className="mt-6 rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-black/5">
        <summary className="cursor-pointer font-semibold">Competition rules in use (not yet confirmed by the organiser)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
          {RULE_ASSUMPTIONS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </>
  );
}
