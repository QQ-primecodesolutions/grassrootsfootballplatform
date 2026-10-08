import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  AddExistingTeamsForm,
  AddNewTeamsForm,
  AdjustmentForm,
  CompetitionForm,
  RulesForm,
} from "@/components/admin/CompetitionForms";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentAdmin } from "@/lib/auth";
import { COMPETITION_TYPE_LABELS } from "@/lib/competitions/input";
import { listTeamsForAdmin } from "@/lib/db/queries/admin";
import { getCompetitionForSetup } from "@/lib/db/queries/setup";
import { describeRules } from "@/lib/rules";
import { todaySast } from "@/lib/time";
import { deleteCompetitionAction, removeAdjustmentAction, removeEntryAction } from "../actions";

export const metadata: Metadata = { title: "Competition" };

export default function CompetitionSetupPage({ params, searchParams }: PageProps<"/admin/competitions/[competitionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompetitionSetup params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const sectionClass = "rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5";
const h2Class = "font-display text-lg font-bold uppercase";

async function CompetitionSetup({
  params,
  searchParams,
}: Pick<PageProps<"/admin/competitions/[competitionId]">, "params" | "searchParams">) {
  const [{ competitionId }, query, { scope, org }] = await Promise.all([params, searchParams, getCurrentAdmin()]);
  const [data, allTeams] = await Promise.all([getCompetitionForSetup(scope, competitionId), listTeamsForAdmin(scope)]);
  if (!data) notFound();
  const { competition: c, entries, adjustments } = data;
  const entered = new Set(entries.map((e) => e.teamId));
  const available = allTeams.filter((t) => !entered.has(t.id)).map((t) => ({ id: t.id, name: t.name, category: t.category }));
  const isLeague = c.type === "league";
  const totalMatches = entries.reduce((n, e) => n + e.matchCount, 0) / 2;

  return (
    <div className="space-y-4">
      <Link href="/admin/competitions" className="text-sm font-semibold text-gray-600">
        ← Competitions
      </Link>
      {query.created ? (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-900 ring-1 ring-green-200">
          Competition created. Next: add its teams below, then add fixtures.
        </p>
      ) : null}
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          {c.name}
          {c.streamLabel ? ` · ${c.streamLabel}` : ""}
        </h1>
        <p className="text-sm text-gray-600">
          {COMPETITION_TYPE_LABELS[c.type]} · {c.seasonName} ·{" "}
          <Link href={`/${org.slug}/${c.slug}`} className="underline">
            public page
          </Link>
        </p>
      </div>

      <section className={sectionClass} aria-labelledby="teams-heading">
        <h2 id="teams-heading" className={h2Class}>
          Teams ({entries.length})
        </h2>
        {entries.length ? (
          <ul className="mt-2 divide-y divide-black/5">
            {entries.map((e) => (
              <li key={e.entryId} className="flex items-center gap-2 py-2">
                <Link href={`/admin/teams/${e.teamId}`} className="min-w-0 flex-1 truncate font-semibold underline-offset-2 hover:underline">
                  {e.name}
                </Link>
                {e.matchCount ? (
                  <span className="text-xs text-gray-600">
                    {e.matchCount} match{e.matchCount === 1 ? "" : "es"}
                  </span>
                ) : (
                  <form action={removeEntryAction}>
                    <input type="hidden" name="competitionId" value={c.id} />
                    <input type="hidden" name="entryId" value={e.entryId} />
                    <button type="submit" className="rounded px-2 py-2 text-sm font-semibold text-red-800">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-600">No teams yet.</p>
        )}
        {entries.length >= 2 ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/admin/fixtures/paste" className="rounded-lg bg-gray-900 px-3 py-3 text-center text-sm font-semibold text-white">
              Paste fixtures
            </Link>
            <Link href="/admin/fixtures/new" className="rounded-lg bg-white px-3 py-3 text-center text-sm font-semibold ring-1 ring-black/15">
              Add a fixture
            </Link>
          </div>
        ) : null}

        {/* Not inside <details>: it must stay open so the "teams added" message stays visible. */}
        <h3 className="mt-4 font-semibold">Add new teams</h3>
        <div className="mt-2">
          <AddNewTeamsForm competitionId={c.id} />
        </div>
        {allTeams.length ? (
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold">Add existing teams ({available.length})</summary>
            <div className="mt-2">
              <AddExistingTeamsForm competitionId={c.id} teams={available} />
            </div>
          </details>
        ) : null}
        <p className="mt-3 text-xs text-gray-600">A team can only be removed before it has matches in this competition.</p>
      </section>

      {isLeague ? (
        <section className={sectionClass} aria-labelledby="rules-heading">
          <h2 id="rules-heading" className={h2Class}>
            Rules
          </h2>
          {c.rules.confirmed ? (
            <p className="mt-1 text-sm font-semibold text-green-800">Confirmed by the organiser.</p>
          ) : (
            <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              <strong>Not yet confirmed by the organiser.</strong> These are defaults. Check them with the organiser, then tick
              “confirmed”.
            </p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {describeRules(c.rules).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold">Change rules</summary>
            <div className="mt-2">
              <RulesForm competitionId={c.id} rules={c.rules} />
            </div>
          </details>
        </section>
      ) : null}

      {isLeague ? (
        <section className={sectionClass} aria-labelledby="adjustments-heading">
          <h2 id="adjustments-heading" className={h2Class}>
            Points adjustments
          </h2>
          <p className="mt-1 text-sm text-gray-600">Deductions or awards announced by the organiser. They change the table.</p>
          {adjustments.length ? (
            <ul className="mt-2 divide-y divide-black/5">
              {adjustments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <strong>
                      {a.teamName} {a.points > 0 ? `+${a.points}` : a.points}
                    </strong>{" "}
                    · {a.reason} · from {a.effectiveOn}
                  </span>
                  <form action={removeAdjustmentAction}>
                    <input type="hidden" name="competitionId" value={c.id} />
                    <input type="hidden" name="adjustmentId" value={a.id} />
                    <button type="submit" className="rounded px-2 py-2 font-semibold text-red-800">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          {entries.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">Add an adjustment</summary>
              <div className="mt-2">
                <AdjustmentForm competitionId={c.id} entries={entries} today={todaySast()} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className={sectionClass} aria-labelledby="settings-heading">
        <h2 id="settings-heading" className={`${h2Class} mb-3`}>
          Settings
        </h2>
        <CompetitionForm
          competition={{
            id: c.id,
            slug: c.slug,
            name: c.name,
            type: c.type,
            seasonName: c.seasonName,
            streamLabel: c.streamLabel,
            area: c.area,
            slogan: c.slogan,
            logoUrl: c.logoUrl,
            facebook: c.socialLinks.facebook ?? null,
            expectedMatchCount: c.expectedMatchCount,
            isFeatured: c.isFeatured,
          }}
        />
      </section>

      {totalMatches === 0 ? (
        <details className="rounded-lg p-3 ring-1 ring-red-200">
          <summary className="cursor-pointer text-sm font-semibold text-red-800">Delete this competition</summary>
          <form action={deleteCompetitionAction} className="mt-2">
            <input type="hidden" name="competitionId" value={c.id} />
            <p className="text-sm text-gray-700">Only possible before it has matches. Its teams stay under Teams.</p>
            <button type="submit" className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">
              Yes, delete {c.name}
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
