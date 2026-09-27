import type { Metadata } from "next";
import { Suspense } from "react";
import { FixtureForm } from "@/components/admin/FixtureForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { competitionOptions } from "@/lib/admin/options";
import { getCurrentAdmin } from "@/lib/auth";
import { listCompetitionsForAdmin, listVenues } from "@/lib/db/queries/admin";
import { todaySast } from "@/lib/time";

export const metadata: Metadata = { title: "Add a fixture" };

export default function NewFixturePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewFixtureContent />
    </Suspense>
  );
}

async function NewFixtureContent() {
  const { scope } = await getCurrentAdmin();
  const [competitions, venues] = await Promise.all([listCompetitionsForAdmin(scope), listVenues(scope)]);
  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Add a fixture</h1>
      <p className="mb-4 text-sm text-gray-600">After saving, the competition, date, time and venue stay filled in for the next one.</p>
      {competitions.length ? (
        <FixtureForm competitions={competitionOptions(competitions)} venues={venues} today={todaySast()} />
      ) : (
        <p>No competitions yet.</p>
      )}
    </>
  );
}
