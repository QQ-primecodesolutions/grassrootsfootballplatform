import { and, asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { competitionTag, matchTag, orgTag, teamTag } from "@/lib/cache/tags";
import { getDb } from "@/lib/db/client";
import {
  clubs,
  competitionEntries,
  competitionSponsors,
  competitions,
  matches,
  pointsAdjustments,
  seasons,
  sponsors,
  teams,
  venues,
} from "@/lib/db/schema";
import { toPublicResult, type PublicMatch, type PublicTeamRef } from "@/lib/match/public";
import { parseRules, type CompetitionRules } from "@/lib/rules";
import type { StandingsAdjustment } from "@/lib/standings";
import type { OrgScope } from "./organisations";

export type CompetitionSummary = {
  id: string;
  slug: string;
  name: string;
  type: "league" | "knockout" | "group_knockout";
  streamLabel: string | null;
  area: string | null;
  slogan: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  seasonName: string;
};

export type CompetitionData = {
  competition: CompetitionSummary & { rules: CompetitionRules; expectedMatchCount: number | null };
  entries: PublicTeamRef[];
  matches: PublicMatch[];
  adjustments: (StandingsAdjustment & { reason: string })[];
  sponsors: { name: string; logoUrl: string | null; websiteUrl: string | null }[];
};

const summaryColumns = {
  id: competitions.id,
  slug: competitions.slug,
  name: competitions.name,
  type: competitions.type,
  streamLabel: competitions.streamLabel,
  area: competitions.area,
  slogan: competitions.slogan,
  logoUrl: competitions.logoUrl,
  isFeatured: competitions.isFeatured,
  seasonName: seasons.name,
};

/** Competitions of an organisation, featured first, newest season first. */
export async function listCompetitions(scope: OrgScope): Promise<CompetitionSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(orgTag(scope.id));
  return getDb()
    .select(summaryColumns)
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(eq(competitions.organisationId, scope.id))
    .orderBy(desc(competitions.isFeatured), desc(seasons.name), asc(competitions.sortOrder), asc(competitions.name));
}

/** Everything needed for a competition's table, fixtures and results tabs. */
export async function getCompetitionData(scope: OrgScope, slug: string): Promise<CompetitionData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(orgTag(scope.id));
  const db = getDb();

  const [comp] = await db
    .select({
      ...summaryColumns,
      rules: competitions.rules,
      expectedMatchCount: competitions.expectedMatchCount,
    })
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(and(eq(competitions.organisationId, scope.id), eq(competitions.slug, slug)))
    .limit(1);
  if (!comp) return null;
  cacheTag(competitionTag(comp.id));

  const entryRows = await db
    .select({
      entryId: competitionEntries.id,
      teamId: teams.id,
      name: teams.name,
      displayName: competitionEntries.displayName,
      shortName: teams.shortName,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
    })
    .from(competitionEntries)
    .innerJoin(teams, eq(teams.id, competitionEntries.teamId))
    .where(and(eq(competitionEntries.organisationId, scope.id), eq(competitionEntries.competitionId, comp.id)))
    .orderBy(asc(teams.name));
  const entries: PublicTeamRef[] = entryRows.map((e) => ({
    entryId: e.entryId,
    teamId: e.teamId,
    name: e.displayName ?? e.name,
    shortName: e.shortName,
    slug: e.slug,
    logoUrl: e.logoUrl,
  }));
  const byEntry = new Map(entries.map((e) => [e.entryId, e]));

  const matchRows = await db
    .select({ m: matches, venueName: venues.name, venueArea: venues.area })
    .from(matches)
    .leftJoin(venues, eq(venues.id, matches.venueId))
    .where(and(eq(matches.organisationId, scope.id), eq(matches.competitionId, comp.id)))
    .orderBy(asc(matches.kickoffAt), asc(matches.roundNumber), asc(matches.id));

  const competitionRef = {
    id: comp.id,
    slug: comp.slug,
    name: comp.name,
    streamLabel: comp.streamLabel,
    area: comp.area,
    type: comp.type,
  };
  const publicMatches: PublicMatch[] = [];
  for (const { m, venueName, venueArea } of matchRows) {
    const home = byEntry.get(m.homeEntryId);
    const away = byEntry.get(m.awayEntryId);
    if (!home || !away) continue; // FK guarantees this; defensive only.
    publicMatches.push({
      id: m.id,
      competition: competitionRef,
      roundLabel: m.roundLabel,
      roundNumber: m.roundNumber,
      kickoffAt: m.kickoffAt,
      kickoffTimeTbc: m.kickoffTimeTbc,
      status: m.status,
      resultState: m.resultState,
      outcomeType: m.outcomeType,
      home,
      away,
      venue: venueName ? { name: venueName, area: venueArea } : null,
      notes: m.notes,
      result: toPublicResult(m),
    });
  }

  const adjustmentRows = await db
    .select({
      entryId: pointsAdjustments.entryId,
      points: pointsAdjustments.points,
      reason: pointsAdjustments.reason,
      effectiveOn: pointsAdjustments.effectiveOn,
    })
    .from(pointsAdjustments)
    .where(and(eq(pointsAdjustments.organisationId, scope.id), eq(pointsAdjustments.competitionId, comp.id)))
    .orderBy(asc(pointsAdjustments.effectiveOn));

  const sponsorRows = await db
    .select({ name: sponsors.name, logoUrl: sponsors.logoUrl, websiteUrl: sponsors.websiteUrl })
    .from(competitionSponsors)
    .innerJoin(sponsors, eq(sponsors.id, competitionSponsors.sponsorId))
    .where(and(eq(competitionSponsors.organisationId, scope.id), eq(competitionSponsors.competitionId, comp.id)))
    .orderBy(asc(competitionSponsors.sortOrder));

  return {
    competition: { ...comp, rules: parseRules(comp.rules) },
    entries,
    matches: publicMatches,
    adjustments: adjustmentRows,
    sponsors: sponsorRows,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which competition a match belongs to (scoped to the organisation). */
export async function findMatchCompetitionSlug(scope: OrgScope, matchId: string): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(orgTag(scope.id), matchTag(matchId));
  if (!UUID.test(matchId)) return null;
  const [row] = await getDb()
    .select({ slug: competitions.slug })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(eq(matches.organisationId, scope.id), eq(matches.id, matchId)))
    .limit(1);
  return row?.slug ?? null;
}

export type TeamSummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  category: string;
  logoUrl: string | null;
  clubName: string;
};

/** A team plus the slugs of competitions it is entered in, latest season first. */
export async function getTeamBySlug(
  scope: OrgScope,
  slug: string,
): Promise<{ team: TeamSummary; competitionSlugs: string[]; seasonName: string | null } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(orgTag(scope.id));
  const db = getDb();
  const [team] = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      name: teams.name,
      shortName: teams.shortName,
      category: teams.category,
      logoUrl: teams.logoUrl,
      clubName: clubs.name,
    })
    .from(teams)
    .innerJoin(clubs, eq(clubs.id, teams.clubId))
    .where(and(eq(teams.organisationId, scope.id), eq(teams.slug, slug)))
    .limit(1);
  if (!team) return null;
  cacheTag(teamTag(team.id));

  const rows = await db
    .select({ slug: competitions.slug, seasonName: seasons.name, competitionId: competitions.id })
    .from(competitionEntries)
    .innerJoin(competitions, eq(competitions.id, competitionEntries.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(and(eq(competitionEntries.organisationId, scope.id), eq(competitionEntries.teamId, team.id)))
    .orderBy(desc(seasons.name), desc(competitions.isFeatured), asc(competitions.sortOrder));
  const seasonName = rows[0]?.seasonName ?? null;
  const current = rows.filter((r) => r.seasonName === seasonName);
  if (current.length) cacheTag(...current.map((r) => competitionTag(r.competitionId)));
  return { team, competitionSlugs: current.map((r) => r.slug), seasonName };
}
