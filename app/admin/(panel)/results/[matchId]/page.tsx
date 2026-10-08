import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GraphicShare } from "@/components/admin/GraphicShare";
import { ResultForm, type ResultFormMatch } from "@/components/admin/ResultForm";
import { SharePanel } from "@/components/admin/SharePanel";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { StatusBadge } from "@/components/public/StatusBadge";
import { matchPreviewShare } from "@/lib/admin/share-links";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdminMatch } from "@/lib/db/queries/admin";
import { siteUrl } from "@/lib/env";
import { competitionGraphicVersion } from "@/lib/graphics/links";
import { graphicPath, type GraphicTarget } from "@/lib/graphics/urls";
import { displayState, formatKickoff } from "@/lib/match/public";
import { shareForMatch } from "@/lib/share/for-match";
import { sastDateKey } from "@/lib/time";

export const metadata: Metadata = { title: "Enter result" };

export default function ResultEntryPage({ params }: PageProps<"/admin/results/[matchId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResultEntry params={params} />
    </Suspense>
  );
}

async function ResultEntry({ params }: Pick<PageProps<"/admin/results/[matchId]">, "params">) {
  const { matchId } = await params;
  const { scope, org } = await getCurrentAdmin();
  const m = await getAdminMatch(scope, matchId);
  if (!m) notFound();

  const share = shareForMatch(m, org, siteUrl());
  const graphics = share ? await graphicLinks(org.slug, m) : [];
  // Before kickoff: a "Team A vs Team B" card to announce the match.
  const preview = !share && m.status === "scheduled" ? await matchPreviewShare(org, m, siteUrl()) : null;
  const formMatch: ResultFormMatch = {
    id: m.id,
    competitionType: m.competitionType,
    homeName: m.home.name,
    awayName: m.away.name,
    status: m.status,
    outcomeType: m.outcomeType,
    resultState: m.resultState,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    htHomeGoals: m.htHomeGoals,
    htAwayGoals: m.htAwayGoals,
    aetHomeGoals: m.aetHomeGoals,
    aetAwayGoals: m.aetAwayGoals,
    penHome: m.penHome,
    penAway: m.penAway,
    walkoverWinner:
      m.outcomeType === "walkover" ? (m.winnerEntryId === m.homeEntryId ? "home" : m.winnerEntryId ? "away" : null) : null,
    notes: m.notes,
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/results" className="text-sm font-semibold text-gray-600">
          ‹ All matches
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold uppercase leading-tight tracking-wide">
          {m.home.name} v {m.away.name}
        </h1>
        <p className="text-sm text-gray-600">
          {[m.competitionName, m.streamLabel, m.roundLabel, formatKickoff(m), m.venueName].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1">
          <StatusBadge state={displayState(m)} />
        </div>
      </div>

      {share ? <SharePanel share={share} graphics={graphics} /> : null}

      <ResultForm match={formMatch} />

      {preview ? (
        <details className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5">
          <summary className="cursor-pointer font-semibold">Announce this match (graphic + WhatsApp)</summary>
          <div className="mt-3">
            <GraphicShare title="Share this match" graphics={preview.graphics} text={preview.text} fileName="match.png" />
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** Download links for a confirmed result: the result card, and the matchday graphic as at its date. */
async function graphicLinks(orgSlug: string, m: NonNullable<Awaited<ReturnType<typeof getAdminMatch>>>) {
  const v = await competitionGraphicVersion(orgSlug, m.competitionSlug);
  if (!v) return [];
  const result: GraphicTarget = { kind: "result", org: orgSlug, matchId: m.id };
  const links: { label: string; size: "portrait" | "square"; target: GraphicTarget; date: string | null }[] = [
    { label: "Result graphic", size: "portrait", target: result, date: null },
    { label: "Result (square)", size: "square", target: result, date: null },
  ];
  if (m.competitionType === "league" && m.kickoffAt) {
    const matchday: GraphicTarget = { kind: "matchday", org: orgSlug, competition: m.competitionSlug };
    const date = sastDateKey(m.kickoffAt);
    links.push(
      { label: "Matchday graphic", size: "portrait", target: matchday, date },
      { label: "Matchday (square)", size: "square", target: matchday, date },
    );
  }
  return links.map((l) => ({
    label: l.label,
    href: graphicPath(l.target, { size: l.size, v, date: l.date }),
    downloadHref: graphicPath(l.target, { size: l.size, v, date: l.date, download: true }),
  }));
}
