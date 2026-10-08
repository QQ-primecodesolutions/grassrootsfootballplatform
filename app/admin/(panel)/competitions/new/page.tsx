import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompetitionForm } from "@/components/admin/CompetitionForms";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentAdmin } from "@/lib/auth";
import { listSeasons } from "@/lib/db/queries/setup";

export const metadata: Metadata = { title: "New competition" };

export default function NewCompetitionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewCompetition />
    </Suspense>
  );
}

async function NewCompetition() {
  const { scope } = await getCurrentAdmin();
  const seasons = (await listSeasons(scope)).map((s) => s.name);
  return (
    <div className="space-y-4">
      <Link href="/admin/competitions" className="text-sm font-semibold text-gray-600">
        ← Competitions
      </Link>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">New competition</h1>
      <CompetitionForm seasons={seasons} defaultSeason={seasons[0]} />
    </div>
  );
}
