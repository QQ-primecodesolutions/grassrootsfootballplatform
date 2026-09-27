import type { AdminMatch } from "@/lib/db/queries/admin";
import { competitionSubtitle, mainScore, scoreDetails, toPublicResult } from "@/lib/match/public";
import { formatShortDate } from "@/lib/time";
import { facebookResultCaption, whatsappResultText, whatsappShareUrl } from "./captions";

export type MatchShare = {
  matchUrl: string;
  tableUrl: string;
  whatsappText: string;
  whatsappUrl: string;
  facebookCaption: string;
};

/** Share links and captions for a confirmed result; null if it isn't public yet. */
export function shareForMatch(
  m: AdminMatch,
  org: { slug: string; hashtags: string[] },
  baseUrl: string,
): MatchShare | null {
  const result = toPublicResult(m);
  const score = mainScore(result);
  if (!result || !score) return null;
  const matchUrl = `${baseUrl}/${org.slug}/match/${m.id}`;
  const tableUrl = `${baseUrl}/${org.slug}/${m.competitionSlug}`;
  const input = {
    homeName: m.home.name,
    awayName: m.away.name,
    score,
    details: scoreDetails(result),
    competitionName: m.competitionName,
    competitionSubtitle: competitionSubtitle({ streamLabel: m.streamLabel, area: null }),
    roundLabel: m.roundLabel,
    dateLabel: m.kickoffAt ? formatShortDate(m.kickoffAt) : null,
    venueName: m.venueName,
    hashtags: org.hashtags,
    matchUrl,
    tableUrl,
  };
  const whatsappText = whatsappResultText(input);
  return {
    matchUrl,
    tableUrl,
    whatsappText,
    whatsappUrl: whatsappShareUrl(whatsappText),
    facebookCaption: facebookResultCaption(input),
  };
}
