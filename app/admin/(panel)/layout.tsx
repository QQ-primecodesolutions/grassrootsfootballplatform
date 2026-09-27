import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentAdmin } from "@/lib/auth";
import { listOrganisationsForAdmin } from "@/lib/db/queries/admin";
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
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4">{children}</main>
      <AdminNav />
    </div>
  );
}

/** Shows the current organisation; lets the single operator switch between partners. */
async function OrgSwitcher() {
  const { org } = await getCurrentAdmin();
  const orgs = await listOrganisationsForAdmin();
  if (orgs.length <= 1) return <span className="block truncate text-sm">{org.name}</span>;
  return (
    <form action={switchOrganisation} className="flex items-center gap-1">
      <label className="sr-only" htmlFor="org-switch">
        Organisation
      </label>
      <select
        id="org-switch"
        name="orgId"
        defaultValue={org.id}
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
