import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/public/EmptyState";
import { FormChips } from "@/components/public/FormChips";
import { MatchList, MatchRow } from "@/components/public/MatchList";
import { Section } from "@/components/public/Section";
import { getCompetitionData, getTeamBySlug, type OrgScope } from "@/lib/db/queries";
import { competitionSubtitle } from "@/lib/match/public";
import { requireOrg } from "@/lib/public/org";
import { fixturesOf, resultsOf, standingsFor, teamMatches } from "@/lib/public/views";

async function loadTeam(scope: OrgScope, slug: string) {
  const found = await getTeamBySlug(scope, slug);
  if (!found) notFound();
  const competitions = (await Promise.all(found.competitionSlugs.map((s) => getCompetitionData(scope, s)))).filter(
    (d): d is NonNullable<typeof d> => d !== null,
  );
  return { ...found, competitions };
}

export async function generateMetadata({ params }: PageProps<"/[org]/team/[teamSlug]">): Promise<Metadata> {
  const { org: orgSlug, teamSlug } = await params;
  const { org, scope } = await requireOrg(orgSlug);
  const { team, seasonName } = await loadTeam(scope, teamSlug);
  return {
    title: team.name,
    description: `${team.name} (${team.category}) fixtures, results and league position${
      seasonName ? ` in ${seasonName}` : ""
    }, from ${org.name}.`,
  };
}

export default async function TeamPage({ params }: PageProps<"/[org]/team/[teamSlug]">) {
  const { org: orgSlug, teamSlug } = await params;
  const { org, scope } = await requireOrg(orgSlug);
  const { team, seasonName, competitions } = await loadTeam(scope, teamSlug);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide">{team.name}</h1>
        <p className="text-sm text-muted">
          {[team.category, team.clubName !== team.name ? team.clubName : null, seasonName].filter(Boolean).join(" · ")}
        </p>
      </header>

      {competitions.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Not entered in a competition yet" />
        </div>
      ) : null}

      {competitions.map((data) => {
        const c = data.competition;
        const matches = teamMatches(data.matches, team.id);
        const results = resultsOf(matches);
        const fixtures = fixturesOf(matches);
        const row = c.type === "league" ? standingsFor(data).find((r) => r.team.teamId === team.id) : undefined;

        return (
          <section key={c.id} className="mt-6">
            <Link href={`/${org.slug}/${c.slug}`} className="font-display text-lg font-bold uppercase tracking-wide hover:underline">
              {c.name}
            </Link>
            {competitionSubtitle(c) ? <p className="text-sm text-muted">{competitionSubtitle(c)}</p> : null}

            {row ? (
              <div className="mt-2 rounded-lg bg-surface p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand font-display text-2xl font-bold text-on-brand">
                    {row.tied ? `${row.position}=` : row.position}
                  </span>
                  <div>
                    <p className="font-display text-2xl font-bold tabular-nums">{row.points} pts</p>
                    <FormChips form={row.form} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm sm:grid-cols-7">
                  {(
                    [
                      ["GP", row.played],
                      ["W", row.won],
                      ["D", row.drawn],
                      ["L", row.lost],
                      ["GF", row.goalsFor],
                      ["GA", row.goalsAgainst],
                      [
                        "GD",
                        row.goalDifference > 0
                          ? `+${row.goalDifference}`
                          : row.goalDifference < 0
                            ? `−${Math.abs(row.goalDifference)}`
                            : "0",
                      ],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="rounded bg-black/[0.04] py-1.5">
                      <dt className="text-xs text-muted">{k}</dt>
                      <dd className="font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <Section title="Fixtures">
              {fixtures.length ? (
                <MatchList>
                  {fixtures.map((m) => (
                    <MatchRow key={m.id} orgSlug={org.slug} match={m} showDate />
                  ))}
                </MatchList>
              ) : (
                <EmptyState title="No fixtures yet" />
              )}
            </Section>
            <Section title="Results">
              {results.length ? (
                <MatchList>
                  {results.map((m) => (
                    <MatchRow key={m.id} orgSlug={org.slug} match={m} showDate />
                  ))}
                </MatchList>
              ) : (
                <EmptyState title="No results yet" />
              )}
            </Section>
          </section>
        );
      })}
    </>
  );
}
