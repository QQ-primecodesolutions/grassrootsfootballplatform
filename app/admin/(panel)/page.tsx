import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminList, AdminMatchRow } from "@/components/admin/AdminMatchRow";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { groupAdminMatches } from "@/lib/admin/match-lists";
import { getCurrentAdmin } from "@/lib/auth";
import { listAdminMatches, listCompetitionsForAdmin } from "@/lib/db/queries/admin";
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

      {competitions.length === 0 ? (
        <section className="mt-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="font-display text-lg font-bold uppercase">Get started</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Create a competition (a league or a cup).</li>
            <li>Add its teams: paste the list of names.</li>
            <li>Add fixtures, then enter results after each match.</li>
          </ol>
          <Link
            href="/admin/competitions/new"
            className="mt-3 block rounded-lg bg-gray-900 px-3 py-4 text-center font-semibold text-white"
          >
            + New competition
          </Link>
        </section>
      ) : null}

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
        <Link href="/admin/competitions" className="rounded-lg bg-white px-3 py-4 text-center font-semibold shadow-sm ring-1 ring-black/10">
          Competitions & teams
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

      {competitions
        .filter((c) => c.type === "league" && !c.rulesConfirmed)
        .map((c) => (
          <Link
            key={c.id}
            href={`/admin/competitions/${c.id}`}
            className="mt-6 block rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-amber-300"
          >
            <strong>Rules not yet confirmed</strong> for {c.name}
            {c.streamLabel ? ` · ${c.streamLabel}` : ""}. The table uses default points and tie-breakers until the
            organiser confirms them. <span className="font-semibold underline">Check the rules</span>
          </Link>
        ))}
    </>
  );
}
