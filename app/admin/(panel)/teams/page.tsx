import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TeamForm } from "@/components/admin/TeamForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentAdmin } from "@/lib/auth";
import { listClubs, listTeamsForAdmin } from "@/lib/db/queries/admin";

export const metadata: Metadata = { title: "Teams" };

export default function TeamsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeamsContent />
    </Suspense>
  );
}

async function TeamsContent() {
  const { scope } = await getCurrentAdmin();
  const [teams, clubs] = await Promise.all([listTeamsForAdmin(scope), listClubs(scope)]);
  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Teams</h1>
      <p className="mb-4 text-sm text-gray-600">
        Aliases are other spellings (e.g. “Tseki Jnr Stars”) used to recognise teams in pasted fixtures.
      </p>
      {teams.length ? (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          {teams.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/teams/${t.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {[t.category, t.clubName !== t.name ? t.clubName : null, t.aliases.length ? `aka ${t.aliases.map((a) => a.alias).join(", ")}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-600">Edit ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">No teams yet.</p>
      )}

      <details className="mt-6 rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
        <summary className="cursor-pointer font-semibold">+ Add a team</summary>
        <div className="mt-3">
          <TeamForm clubs={clubs} />
        </div>
      </details>
      <p className="mt-3 text-xs text-gray-600">
        Registering teams in a competition is done by the seed/scripts for now (admin screen after the demo).
      </p>
    </>
  );
}
