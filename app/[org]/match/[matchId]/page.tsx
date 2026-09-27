import { Suspense } from "react";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/public/StatusBadge";
import { findMatchCompetitionSlug, getCompetitionData, type OrgScope } from "@/lib/db/queries";
import {
  STATE_LABEL,
  competitionSubtitle,
  displayState,
  formatKickoff,
  mainScore,
  scoreDetails,
  type PublicMatch,
} from "@/lib/match/public";
import { requireOrg } from "@/lib/public/org";

async function loadMatch(scope: OrgScope, matchId: string): Promise<PublicMatch> {
  const competitionSlug = await findMatchCompetitionSlug(scope, matchId);
  if (!competitionSlug) notFound();
  const data = await getCompetitionData(scope, competitionSlug);
  const match = data?.matches.find((m) => m.id === matchId);
  if (!match) notFound();
  return match;
}

export async function generateMetadata({ params }: PageProps<"/[org]/match/[matchId]">): Promise<Metadata> {
  const { org: slug, matchId } = await params;
  const { scope } = await requireOrg(slug);
  const m = await loadMatch(scope, matchId);
  const score = mainScore(m.result);
  const title = score ? `${m.home.name} ${score} ${m.away.name}` : `${m.home.name} vs ${m.away.name}`;
  const state = displayState(m);
  return {
    title,
    description: [
      m.competition.name,
      m.roundLabel,
      state === "final" ? "Full time" : state === "scheduled" ? formatKickoff(m) : STATE_LABEL[state],
      m.venue?.name,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Reads the URL and loads data inside the page's Suspense boundary (instant navigation). */
async function MatchPageContent({ params }: Pick<PageProps<"/[org]/match/[matchId]">, "params">) {
  const { org: slug, matchId } = await params;
  const { org, scope } = await requireOrg(slug);
  const m = await loadMatch(scope, matchId);
  const state = displayState(m);
  const score = mainScore(m.result);
  const details = scoreDetails(m.result);
  const winner = m.result?.winnerEntryId ?? null;

  return (
    <article>
      <p className="text-sm text-muted">
        <Link href={`/${org.slug}/${m.competition.slug}`} className="font-semibold text-brand hover:underline">
          {m.competition.name}
        </Link>
        {competitionSubtitle(m.competition) ? ` · ${competitionSubtitle(m.competition)}` : null}
        {m.roundLabel ? ` · ${m.roundLabel}` : null}
      </p>

      <section className="mt-3 rounded-lg bg-surface p-4 shadow-sm ring-1 ring-black/5" aria-label="Score">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <TeamName orgSlug={org.slug} team={m.home} winner={winner} />
          <div>
            {score ? (
              <span className="inline-block rounded-lg bg-brand px-4 py-2 font-display text-4xl font-bold tabular-nums text-on-brand">
                {score}
              </span>
            ) : (
              <span className="font-display text-2xl font-bold text-muted">vs</span>
            )}
          </div>
          <TeamName orgSlug={org.slug} team={m.away} winner={winner} />
        </div>
        <div className="mt-3 flex flex-col items-center gap-1 text-center text-sm">
          <StatusBadge state={state} />
          {details.map((d) => (
            <span key={d} className="text-muted">
              {d}
            </span>
          ))}
          {state === "pending" ? (
            <span className="text-muted">The score will show here once the organiser confirms it.</span>
          ) : null}
        </div>
      </section>

      <dl className="mt-4 divide-y divide-black/5 rounded-lg bg-surface text-sm shadow-sm ring-1 ring-black/5">
        <Row label="Kick-off" value={formatKickoff(m)} />
        <Row label="Venue" value={m.venue ? [m.venue.name, m.venue.area].filter(Boolean).join(", ") : "To be confirmed"} />
        {m.roundLabel ? <Row label="Round" value={m.roundLabel} /> : null}
        <Row label="Status" value={STATE_LABEL[state]} />
        {m.notes ? <Row label="Note" value={m.notes} /> : null}
      </dl>
    </article>
  );
}

function TeamName({ orgSlug, team, winner }: { orgSlug: string; team: PublicMatch["home"]; winner: string | null }) {
  return (
    <Link
      href={`/${orgSlug}/team/${team.slug}`}
      className={`block font-display text-xl uppercase leading-tight tracking-wide hover:underline ${
        winner === team.entryId ? "font-bold" : "font-semibold"
      }`}
    >
      {team.name}
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{value}</dd>
    </div>
  );
}

export default function MatchPage({ params }: PageProps<"/[org]/match/[matchId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MatchPageContent params={params} />
    </Suspense>
  );
}
