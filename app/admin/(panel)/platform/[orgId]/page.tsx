import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InviteForm, MemberLinkButton } from "@/components/admin/AdminInvites";
import { OrganisationForm } from "@/components/admin/OrganisationForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentSuperAdmin } from "@/lib/auth";
import { getOrganisationForPlatform } from "@/lib/db/queries/platform";
import { formatShortDate } from "@/lib/time";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { removeAdminAction, setListedAction, setRoleAction, workInOrganisationAction } from "../actions";

export const metadata: Metadata = { title: "Organisation" };

export default function PlatformOrganisationPage({ params, searchParams }: PageProps<"/admin/platform/[orgId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatformOrganisation params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlatformOrganisation({
  params,
  searchParams,
}: Pick<PageProps<"/admin/platform/[orgId]">, "params" | "searchParams">) {
  const [{ orgId }, query] = await Promise.all([params, searchParams]);
  const { platform } = await getCurrentSuperAdmin();
  const data = await getOrganisationForPlatform(platform, orgId);
  if (!data) notFound();
  const { org, members } = data;

  return (
    <div className="space-y-4">
      <Link href="/admin/platform" className="text-sm font-semibold text-gray-600">
        ← Platform
      </Link>
      {query.created ? (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-900 ring-1 ring-green-200">
          Organisation created. Next: add its admin below, then set up its competition and teams.
        </p>
      ) : null}
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">{org.name}</h1>
        <p className="text-sm text-gray-600">
          <Link href={`/${org.slug}`} className="underline">
            /{org.slug}
          </Link>{" "}
          · {org.listed ? "Listed on the home page" : "Unlisted (works by link only)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <form action={workInOrganisationAction}>
          <input type="hidden" name="orgId" value={org.id} />
          <button type="submit" className="h-12 w-full rounded-lg bg-gray-900 font-semibold text-white">
            Work in this org
          </button>
        </form>
        <form action={setListedAction}>
          <input type="hidden" name="orgId" value={org.id} />
          <input type="hidden" name="listed" value={org.listed ? "false" : "true"} />
          <button type="submit" className="h-12 w-full rounded-lg bg-white font-semibold ring-1 ring-black/15">
            {org.listed ? "Unlist" : "List on home page"}
          </button>
        </form>
      </div>

      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5">
        <h2 className="font-display text-lg font-bold uppercase">People</h2>
        {members.length ? (
          <ul className="mt-2 divide-y divide-black/5">
            {members.map((m) => (
              <li key={m.userId} className="space-y-2 py-3">
                <div>
                  <p className="font-semibold">
                    {m.name}{" "}
                    {m.status === "invited" ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Invited</span>
                    ) : null}
                  </p>
                  <p className="text-sm font-semibold text-gray-700">{ROLE_LABELS[m.role]}</p>
                  <p className="break-all text-sm text-gray-600">
                    {m.email}
                    {m.lastLoginAt ? ` · last sign-in ${formatShortDate(m.lastLoginAt)}` : ""}
                  </p>
                </div>
                <MemberLinkButton orgId={org.id} orgName={org.name} userId={m.userId} name={m.name} active={m.status === "active"} />
                <form action={setRoleAction}>
                  <input type="hidden" name="orgId" value={org.id} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <input type="hidden" name="role" value={m.role === "scorer" ? "org_admin" : "scorer"} />
                  <button type="submit" className="text-sm font-semibold text-gray-700 underline">
                    {m.role === "scorer" ? "Make organisation admin" : "Make scorer"}
                  </button>
                </form>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-red-800">Remove from {org.name}</summary>
                  <form action={removeAdminAction} className="mt-2">
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="userId" value={m.userId} />
                    <button type="submit" className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">
                      Yes, remove {m.name}
                    </button>
                    <p className="mt-1 text-xs text-gray-600">They are signed out straight away.</p>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-600">No one yet.</p>
        )}
        <h3 className="mt-4 mb-2 font-semibold">Add a person</h3>
        <InviteForm orgId={org.id} orgName={org.name} />
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 font-display text-lg font-bold uppercase">Details and branding</h2>
        <OrganisationForm
          organisation={{
            id: org.id,
            slug: org.slug,
            name: org.name,
            shortName: org.shortName,
            tagline: org.tagline,
            primaryColor: org.primaryColor,
            secondaryColor: org.secondaryColor,
            logoUrl: org.logoUrl,
            facebook: org.socialLinks.facebook ?? null,
            hashtags: org.hashtags,
          }}
        />
      </section>
    </div>
  );
}
