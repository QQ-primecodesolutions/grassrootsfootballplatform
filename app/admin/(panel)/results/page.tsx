import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminList, AdminMatchRow } from "@/components/admin/AdminMatchRow";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { groupAdminMatches } from "@/lib/admin/match-lists";
import { getCurrentAdmin } from "@/lib/auth";
import { listAdminMatches } from "@/lib/db/queries/admin";
import { todaySast } from "@/lib/time";

export const metadata: Metadata = { title: "Results" };

export default function AdminResultsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResultsList />
    </Suspense>
  );
}

async function ResultsList() {
  const { scope } = await getCurrentAdmin();
  const groups = groupAdminMatches(await listAdminMatches(scope), todaySast());
  const sections = [
    { title: "Today", items: groups.today, showDate: false, empty: "No matches today." },
    { title: "Needs a result", items: groups.needsResult, showDate: true, empty: "Nothing outstanding." },
    { title: "Coming up (7 days)", items: groups.upcoming, showDate: true, empty: "No fixtures in the next week." },
    { title: "Recently confirmed (14 days)", items: groups.recent, showDate: true, empty: "No confirmed results in the last two weeks." },
  ];

  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Results</h1>
      <p className="text-sm text-gray-600">Tap a match to enter or confirm its result.</p>
      {sections.map((s) => (
        <section key={s.title} className="mt-5">
          <h2 className="mb-2 font-display text-lg font-bold uppercase">{s.title}</h2>
          {s.items.length ? (
            <AdminList>
              {s.items.map((m) => (
                <AdminMatchRow key={m.id} match={m} showDate={s.showDate} />
              ))}
            </AdminList>
          ) : (
            <p className="text-sm text-gray-600">{s.empty}</p>
          )}
        </section>
      ))}
    </>
  );
}
