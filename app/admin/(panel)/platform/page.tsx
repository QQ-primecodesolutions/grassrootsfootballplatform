import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentSuperAdmin } from "@/lib/auth";
import { listOrganisationsForPlatform, listSuperAdmins } from "@/lib/db/queries/platform";
import { formatShortDate } from "@/lib/time";

export const metadata: Metadata = { title: "Platform" };

export default function PlatformPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Platform />
    </Suspense>
  );
}

async function Platform() {
  const { platform } = await getCurrentSuperAdmin();
  const [orgs, superAdmins] = await Promise.all([listOrganisationsForPlatform(platform), listSuperAdmins(platform)]);

  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Platform</h1>
      <p className="text-sm text-gray-600">Organisations using the platform, and who can manage them.</p>

      <Link
        href="/admin/platform/new"
        className="mt-4 block rounded-lg bg-gray-900 px-3 py-4 text-center font-semibold text-white"
      >
        + New organisation
      </Link>

      <h2 className="mt-6 mb-2 font-display text-lg font-bold uppercase">Organisations</h2>
      {orgs.length ? (
        <ul className="divide-y divide-black/5 rounded-lg bg-white shadow-sm ring-1 ring-black/5">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/platform/${o.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.name}</span>
                  <span className="block text-sm text-gray-600">
                    /{o.slug} · {o.adminCount} admin{o.adminCount === 1 ? "" : "s"}
                  </span>
                </span>
                {o.listed ? null : (
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Unlisted</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">No organisations yet.</p>
      )}

      <h2 className="mt-6 mb-2 font-display text-lg font-bold uppercase">Platform admins</h2>
      <ul className="space-y-1 text-sm">
        {superAdmins.map((u) => (
          <li key={u.id}>
            <strong>{u.name}</strong> · {u.email}
            {u.lastLoginAt ? <span className="text-gray-600"> · last sign-in {formatShortDate(u.lastLoginAt)}</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-600">Platform admins are added from the command line (pnpm admin:super; see README).</p>
    </>
  );
}
