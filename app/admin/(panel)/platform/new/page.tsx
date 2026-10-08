import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrganisationForm } from "@/components/admin/OrganisationForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentSuperAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New organisation" };

export default function NewOrganisationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewOrganisation />
    </Suspense>
  );
}

async function NewOrganisation() {
  await getCurrentSuperAdmin();
  return (
    <div className="space-y-4">
      <Link href="/admin/platform" className="text-sm font-semibold text-gray-600">
        ← Platform
      </Link>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">New organisation</h1>
      <p className="text-sm text-gray-600">
        It starts <strong>unlisted</strong>: its page works by link, but it isn&apos;t shown on the home page until you list it.
      </p>
      <OrganisationForm />
    </div>
  );
}
