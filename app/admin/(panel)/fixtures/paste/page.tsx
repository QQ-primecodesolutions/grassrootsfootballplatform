import type { Metadata } from "next";
import { Suspense } from "react";
import { PasteFixtures } from "@/components/admin/PasteFixtures";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { competitionOptions } from "@/lib/admin/options";
import { getCurrentAdmin } from "@/lib/auth";
import { listCompetitionsForAdmin, listVenues } from "@/lib/db/queries/admin";
import { todaySast } from "@/lib/time";

export const metadata: Metadata = { title: "Paste fixtures" };

export default function PasteFixturesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PasteFixturesContent />
    </Suspense>
  );
}

async function PasteFixturesContent() {
  const { scope } = await getCurrentAdmin();
  const [competitions, venues] = await Promise.all([listCompetitionsForAdmin(scope), listVenues(scope)]);
  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Paste fixtures</h1>
      <p className="mb-4 text-sm text-gray-600">Paste fixtures the way they were typed in WhatsApp. Check the preview, then save.</p>
      {competitions.length ? (
        <PasteFixtures competitions={competitionOptions(competitions)} venues={venues} today={todaySast()} />
      ) : (
        <p>No competitions yet.</p>
      )}
    </>
  );
}
