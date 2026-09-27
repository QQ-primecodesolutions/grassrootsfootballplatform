import { Suspense } from "react";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import type { Metadata } from "next";
import { CompetitionHeader } from "@/components/public/CompetitionHeader";
import { EmptyState } from "@/components/public/EmptyState";
import { MatchList, MatchRow } from "@/components/public/MatchList";
import { Section } from "@/components/public/Section";
import { competitionMetadata, requireCompetition } from "@/lib/public/competition";
import { groupByDate, resultsOf } from "@/lib/public/views";

export async function generateMetadata({ params }: PageProps<"/[org]/[competition]/results">): Promise<Metadata> {
  const { org, competition } = await params;
  return competitionMetadata(org, competition, "results");
}

/** Reads the URL and loads data inside the page's Suspense boundary (instant navigation). */
async function ResultsPageContent({ params }: Pick<PageProps<"/[org]/[competition]/results">, "params">) {
  const { org: orgSlug, competition: slug } = await params;
  const { org, data } = await requireCompetition(orgSlug, slug);
  const days = groupByDate(resultsOf(data.matches));

  return (
    <>
      <CompetitionHeader orgSlug={org.slug} competition={data.competition} active="results" />
      {days.length ? (
        days.map((d) => (
          <Section key={d.key} title={d.label}>
            <MatchList>
              {d.matches.map((m) => (
                <MatchRow key={m.id} orgSlug={org.slug} match={m} />
              ))}
            </MatchList>
          </Section>
        ))
      ) : (
        <EmptyState title="No results yet">Confirmed results will appear here.</EmptyState>
      )}
    </>
  );
}

export default function ResultsPage({ params }: PageProps<"/[org]/[competition]/results">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResultsPageContent params={params} />
    </Suspense>
  );
}
