import type { AdminMatch } from "@/lib/db/queries/admin";
import { competitionGraphicVersion } from "@/lib/graphics/links";
import { graphicPath, type GraphicLink, type GraphicTarget } from "@/lib/graphics/urls";
import { competitionSubtitle } from "@/lib/match/public";
import { whatsappFixturesText, whatsappMatchPreviewText, type FixtureLine } from "@/lib/share/fixtures";
import { formatShortDate, formatTime } from "@/lib/time";

/*
 * Admin share links for fixtures (before matches are played): versioned graphic URLs
 * (portrait for WhatsApp status, square for Facebook) and the WhatsApp message.
 */

async function links(orgSlug: string, competitionSlug: string, target: GraphicTarget, labels: [string, string], date?: string) {
  const v = await competitionGraphicVersion(orgSlug, competitionSlug);
  if (!v) return [];
  return (["portrait", "square"] as const).map(
    (size, i): GraphicLink => ({
      label: labels[i]!,
      href: graphicPath(target, { size, v, date }),
      downloadHref: graphicPath(target, { size, v, date, download: true }),
    }),
  );
}

const lineOf = (m: AdminMatch): FixtureLine => ({
  homeName: m.home.name,
  awayName: m.away.name,
  time: m.kickoffAt && !m.kickoffTimeTbc ? formatTime(m.kickoffAt) : null,
  venueName: m.venueName,
  roundLabel: m.roundLabel,
});

const competitionLineOf = (m: AdminMatch) =>
  [m.competitionName, competitionSubtitle({ streamLabel: m.streamLabel, area: null })].filter(Boolean).join(" · ");

/** Fixtures graphic + message for one competition's match day. `matches` share that day. */
export async function fixturesShare(
  org: { slug: string; hashtags: string[] },
  matches: AdminMatch[],
  date: string,
  baseUrl: string,
) {
  const first = matches[0]!;
  const target: GraphicTarget = { kind: "fixtures", org: org.slug, competition: first.competitionSlug };
  return {
    graphics: await links(org.slug, first.competitionSlug, target, ["Fixtures graphic", "Fixtures (square)"], date),
    text: whatsappFixturesText({
      competitionLine: competitionLineOf(first),
      dateLabel: formatShortDate(first.kickoffAt!),
      fixtures: matches.map(lineOf),
      hashtags: org.hashtags,
      url: `${baseUrl}/${org.slug}/${first.competitionSlug}/fixtures`,
    }),
  };
}

/** Match card ("A vs B", date, time, venue) + message for one upcoming match. */
export async function matchPreviewShare(org: { slug: string; hashtags: string[] }, m: AdminMatch, baseUrl: string) {
  const target: GraphicTarget = { kind: "match", org: org.slug, matchId: m.id };
  const matchUrl = `${baseUrl}/${org.slug}/match/${m.id}`;
  return {
    graphics: await links(org.slug, m.competitionSlug, target, ["Match graphic", "Match (square)"]),
    text: whatsappMatchPreviewText({
      ...lineOf(m),
      competitionLine: competitionLineOf(m),
      dateLabel: m.kickoffAt ? formatShortDate(m.kickoffAt) : null,
      hashtags: org.hashtags,
      matchUrl,
    }),
  };
}
