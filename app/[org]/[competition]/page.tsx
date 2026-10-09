import { Suspense } from "react";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import type { Metadata } from "next";
import { CompetitionHeader } from "@/components/public/CompetitionHeader";
import { EmptyState } from "@/components/public/EmptyState";
import { MatchList, MatchRow } from "@/components/public/MatchList";
import { Section } from "@/components/public/Section";
import { StandingsTable } from "@/components/public/StandingsTable";
import { competitionMetadata, requireCompetition } from "@/lib/public/competition";
import { groupTables, knockoutMatches } from "@/lib/public/groups";
import { groupByRound, standingsFor } from "@/lib/public/views";

export async function generateMetadata({ params }: PageProps<"/[org]/[competition]">): Promise<Metadata> {
  const { org, competition } = await params;
  return competitionMetadata(org, competition, "table");
}

/** Reads the URL and loads data inside the page's Suspense boundary (instant navigation). */
async function CompetitionTablePageContent({ params }: Pick<PageProps<"/[org]/[competition]">, "params">) {
  const { org: orgSlug, competition: slug } = await params;
  const { org, data } = await requireCompetition(orgSlug, slug);
  const c = data.competition;

  if (c.type === "group_knockout") {
    const groups = groupTables(data);
    const rounds = groupByRound(knockoutMatches(data.matches));
    return (
      <>
        <CompetitionHeader orgSlug={org.slug} competition={c} active="table" />
        {groups.length ? (
          groups.map((g) => (
            <Section key={g.label} title={`Group ${g.label}`}>
              <StandingsTable orgSlug={org.slug} rows={g.rows} variant="compact" caption={`${c.name} Group ${g.label}`} />
            </Section>
          ))
        ) : (
          <EmptyState title="Groups not drawn yet" />
        )}
        {rounds.map((r) => (
          <Section key={r.label} title={r.label === "Matches" ? "Knockout" : r.label}>
            <MatchList>
              {r.matches.map((m) => (
                <MatchRow key={m.id} orgSlug={org.slug} match={m} showDate showRound={false} />
              ))}
            </MatchList>
          </Section>
        ))}
        <p className="mt-2 text-xs text-muted">Group tables count confirmed group-stage results only.</p>
      </>
    );
  }

  if (c.type !== "league") {
    // Knockout: no table; list every match by round.
    const rounds = groupByRound(data.matches);
    return (
      <>
        <CompetitionHeader orgSlug={org.slug} competition={c} active="table" />
        {rounds.length ? (
          rounds.map((r) => (
            <Section key={r.label} title={r.label}>
              <MatchList>
                {r.matches.map((m) => (
                  <MatchRow key={m.id} orgSlug={org.slug} match={m} showDate showRound={false} />
                ))}
              </MatchList>
            </Section>
          ))
        ) : (
          <EmptyState title="No fixtures yet" />
        )}
      </>
    );
  }

  const rows = standingsFor(data);
  const adjusted = data.adjustments;
  const nameOf = new Map(data.entries.map((e) => [e.entryId, e.name]));

  return (
    <>
      <CompetitionHeader orgSlug={org.slug} competition={c} active="table" />
      {rows.length ? (
        <StandingsTable orgSlug={org.slug} rows={rows} caption={`${c.name} table`} />
      ) : (
        <EmptyState title="No teams registered yet" />
      )}
      <p className="mt-2 text-xs text-muted">
        GP games played · W won · D drawn · L lost · GF goals for · GA goals against · GD goal difference · Pts points.
        Only confirmed results count.
      </p>
      {adjusted.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {adjusted.map((a, i) => (
            <li key={i} className="text-negative">
              {nameOf.get(a.entryId)}: {a.points > 0 ? "+" : "−"}
              {Math.abs(a.points)} pts — {a.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export default function CompetitionTablePage({ params }: PageProps<"/[org]/[competition]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompetitionTablePageContent params={params} />
    </Suspense>
  );
}
