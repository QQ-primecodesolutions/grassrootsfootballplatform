import type { Metadata } from "next";
import { CompetitionHeader } from "@/components/public/CompetitionHeader";
import { EmptyState } from "@/components/public/EmptyState";
import { MatchList, MatchRow } from "@/components/public/MatchList";
import { Section } from "@/components/public/Section";
import { StandingsTable } from "@/components/public/StandingsTable";
import { competitionMetadata, requireCompetition } from "@/lib/public/competition";
import { groupByRound, standingsFor } from "@/lib/public/views";

export async function generateMetadata({ params }: PageProps<"/[org]/[competition]">): Promise<Metadata> {
  const { org, competition } = await params;
  return competitionMetadata(org, competition, "table");
}

export default async function CompetitionTablePage({ params }: PageProps<"/[org]/[competition]">) {
  const { org: orgSlug, competition: slug } = await params;
  const { org, data } = await requireCompetition(orgSlug, slug);
  const c = data.competition;

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
