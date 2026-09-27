import type { Metadata } from "next";
import { CompetitionHeader } from "@/components/public/CompetitionHeader";
import { EmptyState } from "@/components/public/EmptyState";
import { MatchList, MatchRow } from "@/components/public/MatchList";
import { Section } from "@/components/public/Section";
import { competitionMetadata, requireCompetition } from "@/lib/public/competition";
import { fixturesOf, groupByDate } from "@/lib/public/views";

export async function generateMetadata({ params }: PageProps<"/[org]/[competition]/fixtures">): Promise<Metadata> {
  const { org, competition } = await params;
  return competitionMetadata(org, competition, "fixtures");
}

export default async function FixturesPage({ params }: PageProps<"/[org]/[competition]/fixtures">) {
  const { org: orgSlug, competition: slug } = await params;
  const { org, data } = await requireCompetition(orgSlug, slug);
  const days = groupByDate(fixturesOf(data.matches));

  return (
    <>
      <CompetitionHeader orgSlug={org.slug} competition={data.competition} active="fixtures" />
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
        <EmptyState title="No fixtures yet">Check back soon for the next matchday.</EmptyState>
      )}
    </>
  );
}
