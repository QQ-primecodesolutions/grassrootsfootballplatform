import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResultForm, type ResultFormMatch } from "@/components/admin/ResultForm";
import { SharePanel } from "@/components/admin/SharePanel";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { StatusBadge } from "@/components/public/StatusBadge";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdminMatch } from "@/lib/db/queries/admin";
import { siteUrl } from "@/lib/env";
import { displayState, formatKickoff } from "@/lib/match/public";
import { shareForMatch } from "@/lib/share/for-match";

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

      {share ? <SharePanel share={share} /> : null}

      <ResultForm match={formMatch} />
    </div>
  );
}
