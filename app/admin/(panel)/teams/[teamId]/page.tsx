import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AliasForm } from "@/components/admin/AliasForm";
import { TeamForm } from "@/components/admin/TeamForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentAdmin } from "@/lib/auth";
import { listClubs, listTeamsForAdmin } from "@/lib/db/queries/admin";
import { removeAliasAction } from "../actions";

export const metadata: Metadata = { title: "Edit team" };

export default function EditTeamPage({ params }: PageProps<"/admin/teams/[teamId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditTeam params={params} />
    </Suspense>
  );
}

async function EditTeam({ params }: Pick<PageProps<"/admin/teams/[teamId]">, "params">) {
  const { teamId } = await params;
  const { scope, org } = await getCurrentAdmin();
  const [teams, clubs] = await Promise.all([listTeamsForAdmin(scope), listClubs(scope)]);
  const team = teams.find((t) => t.id === teamId);
  if (!team) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/teams" className="text-sm font-semibold text-gray-600">
          ‹ All teams
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">{team.name}</h1>
        <Link href={`/${org.slug}/team/${team.slug}`} className="text-sm underline">
          Public team page
        </Link>
      </div>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 font-display text-lg font-bold uppercase">Other spellings</h2>
        {team.aliases.length ? (
          <ul className="mb-3 flex flex-wrap gap-2">
            {team.aliases.map((a) => (
              <li key={a.id} className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm">
                {a.alias}
                <form action={removeAliasAction}>
                  <input type="hidden" name="aliasId" value={a.id} />
                  <button type="submit" aria-label={`Remove “${a.alias}”`} className="h-8 w-8 rounded-full text-gray-600 hover:bg-gray-200">
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-gray-600">None yet.</p>
        )}
        <AliasForm teamId={team.id} />
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 font-display text-lg font-bold uppercase">Details</h2>
        <TeamForm
          team={{
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            category: team.category,
            gender: team.gender,
            logoUrl: team.logoUrl,
            clubId: team.clubId,
          }}
          clubs={clubs}
        />
        <p className="mt-2 text-xs text-gray-600">The public link (/{org.slug}/team/{team.slug}) stays the same when you rename.</p>
      </section>
    </div>
  );
}
