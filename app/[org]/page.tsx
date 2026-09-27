import { Suspense } from "react";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import Link from "next/link";
import { EmptyState } from "@/components/public/EmptyState";
import { MatchList, MatchRow } from "@/components/public/MatchList";
import { Section } from "@/components/public/Section";
import { StandingsTable } from "@/components/public/StandingsTable";
import { getCompetitionData, listCompetitions } from "@/lib/db/queries";
import { competitionSubtitle } from "@/lib/match/public";
import { requireOrg } from "@/lib/public/org";
import { resultsOf, standingsFor, upcomingOf } from "@/lib/public/views";

/** Reads the URL and loads data inside the page's Suspense boundary (instant navigation). */
async function OrgHomePageContent({ params }: Pick<PageProps<"/[org]">, "params">) {
  const { org: slug } = await params;
  const { org, scope } = await requireOrg(slug);
  const competitions = await listCompetitions(scope);
  const all = (await Promise.all(competitions.map((c) => getCompetitionData(scope, c.slug)))).filter(
    (d): d is NonNullable<typeof d> => d !== null,
  );

  const featured = all.find((d) => d.competition.type === "league") ?? null;
  const allMatches = all.flatMap((d) => d.matches);
  const latest = resultsOf(allMatches).slice(0, 5);
  const upcoming = upcomingOf(allMatches).slice(0, 6);
  const multi = all.length > 1;

  if (all.length === 0) {
    return <EmptyState title="No competitions yet">{org.name} hasn&apos;t published a competition yet.</EmptyState>;
  }

  return (
    <>
      {featured ? (
        <section>
          <div className="mb-2">
            <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide">
              {featured.competition.name}
            </h1>
            <p className="text-sm text-muted">
              {[competitionSubtitle(featured.competition), featured.competition.seasonName].filter(Boolean).join(" · ")}
            </p>
          </div>
          {featured.entries.length ? (
            <StandingsTable
              orgSlug={org.slug}
              rows={standingsFor(featured)}
              variant="compact"
              caption={`${featured.competition.name} table`}
            />
          ) : (
            <EmptyState title="No teams registered yet" />
          )}
          <Link
            href={`/${org.slug}/${featured.competition.slug}`}
            className="mt-2 block rounded-lg bg-brand py-3 text-center font-semibold text-on-brand"
          >
            Full table, fixtures and results
          </Link>
        </section>
      ) : null}

      <Section title="Latest results">
        {latest.length ? (
          <MatchList>
            {latest.map((m) => (
              <MatchRow key={m.id} orgSlug={org.slug} match={m} showCompetition={multi} showDate />
            ))}
          </MatchList>
        ) : (
          <EmptyState title="No results yet">Confirmed results will appear here.</EmptyState>
        )}
      </Section>

      <Section title="Upcoming fixtures">
        {upcoming.length ? (
          <MatchList>
            {upcoming.map((m) => (
              <MatchRow key={m.id} orgSlug={org.slug} match={m} showCompetition={multi} showDate />
            ))}
          </MatchList>
        ) : (
          <EmptyState title="No fixtures yet">Check back soon for the next matchday.</EmptyState>
        )}
      </Section>

      {multi ? (
        <Section title="Competitions">
          <ul className="space-y-2">
            {all.map(({ competition: c }) => (
              <li key={c.id}>
                <Link
                  href={`/${org.slug}/${c.slug}`}
                  className="block rounded-lg bg-surface px-4 py-3 shadow-sm ring-1 ring-black/5 hover:ring-black/20"
                >
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block text-sm text-muted">
                    {[competitionSubtitle(c), c.seasonName].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

export default function OrgHomePage({ params }: PageProps<"/[org]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgHomePageContent params={params} />
    </Suspense>
  );
}
