import type { Metadata } from "next";
import { Suspense } from "react";
import { AddScorerForm, ScorerLinkButton } from "@/components/admin/ScorerForms";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { listOrgPeople } from "@/lib/db/queries/people";
import { formatShortDate } from "@/lib/time";
import { removeScorerAction } from "./actions";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <People />
    </Suspense>
  );
}

async function People() {
  const { scope, org, user } = await getCurrentAdmin();
  const people = await listOrgPeople(scope);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">People</h1>
        <p className="text-sm text-gray-600">
          Who can work on {org.name}. Add scorers to enter scores at the ground: you check and publish them.
        </p>
      </div>

      <ul className="divide-y divide-black/5 rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        {people.map((p) => (
          <li key={p.userId} className="space-y-2 px-3 py-3">
            <div>
              <p className="font-semibold">
                {p.name}
                {p.userId === user.id ? <span className="font-normal text-gray-600"> (you)</span> : null}{" "}
                {p.status === "invited" ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Invited</span>
                ) : null}
              </p>
              <p className="text-sm font-semibold text-gray-700">{ROLE_LABELS[p.role]}</p>
              <p className="break-all text-sm text-gray-600">
                {p.email}
                {p.lastLoginAt ? ` · last sign-in ${formatShortDate(p.lastLoginAt)}` : ""}
              </p>
            </div>
            {p.role === "scorer" ? (
              p.manageable ? (
                <>
                  <ScorerLinkButton userId={p.userId} active={p.status === "active"} />
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-red-800">Remove {p.name}</summary>
                    <form action={removeScorerAction} className="mt-2">
                      <input type="hidden" name="userId" value={p.userId} />
                      <button type="submit" className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">
                        Yes, remove {p.name}
                      </button>
                    </form>
                  </details>
                </>
              ) : (
                <p className="text-xs text-gray-600">Also works with another organisation: the platform admin manages their account.</p>
              )
            ) : null}
          </li>
        ))}
      </ul>

      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 font-display text-lg font-bold uppercase">Add a scorer</h2>
        <AddScorerForm />
        <p className="mt-3 text-xs text-gray-600">
          Scorers see only Results. Their scores stay private until you publish them. To add another organisation admin, ask
          the platform admin.
        </p>
      </section>
    </div>
  );
}
