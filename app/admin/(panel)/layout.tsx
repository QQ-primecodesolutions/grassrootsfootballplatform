import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentUser } from "@/lib/auth";
import { listAccessibleOrgs, resolveAdminOrg } from "@/lib/db/queries/accounts";
import { publicEnv } from "@/lib/env";
import { logout, switchOrganisation } from "../actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${publicEnv.NEXT_PUBLIC_APP_NAME}` },
  robots: { index: false, follow: false },
};

export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-gray-100 text-gray-900">
      <header className="bg-gray-900 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2">
          <Link href="/admin" className="font-display text-lg font-bold uppercase tracking-wide">
            Admin
          </Link>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<span className="text-sm opacity-60">…</span>}>
              <OrgSwitcher />
            </Suspense>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded px-2 py-2 text-sm opacity-80 hover:opacity-100">
              Log out
            </button>
          </form>
        </div>
        <Suspense fallback={<div className="h-8" />}>
          <UserBar />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4">{children}</main>
      <Suspense fallback={<AdminNav scorer />}>
        <RoleNav />
      </Suspense>
    </div>
  );
}

/** Shows the current organisation; lets the user switch between the ones they can access. */
async function OrgSwitcher() {
  const { user, orgId } = await getCurrentUser();
  const [current, orgs] = await Promise.all([resolveAdminOrg(user, orgId), listAccessibleOrgs(user)]);
  if (!current) return <span className="block truncate text-sm opacity-80">No organisation yet</span>;
  if (orgs.length <= 1) return <span className="block truncate text-sm">{current.org.name}</span>;
  return (
    <form action={switchOrganisation} className="flex items-center gap-1">
      <label className="sr-only" htmlFor="org-switch">
        Organisation
      </label>
      <select
        id="org-switch"
        name="orgId"
        defaultValue={current.org.id}
        className="min-w-0 flex-1 truncate rounded bg-gray-800 px-2 py-2 text-sm text-white"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded bg-gray-700 px-2 py-2 text-sm">
        Switch
      </button>
    </form>
  );
}

/** The bottom bar for the user's role in the current organisation. */
async function RoleNav() {
  const { user, orgId } = await getCurrentUser();
  const current = await resolveAdminOrg(user, orgId);
  return <AdminNav scorer={current?.org.role === "scorer"} />;
}

async function UserBar() {
  const { user } = await getCurrentUser();
  return (
    <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-2 text-sm">
      <span className="min-w-0 flex-1 truncate opacity-70">{user.name}</span>
      <Link href="/admin/account" className="py-1 underline opacity-90">
        Account
      </Link>
      {user.isSuperAdmin ? (
        <Link href="/admin/platform" className="py-1 font-semibold underline">
          Platform
        </Link>
      ) : null}
    </div>
  );
}
