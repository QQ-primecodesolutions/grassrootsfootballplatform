import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import {
  clubs,
  competitionEntries,
  competitions,
  matches,
  organisations,
  seasons,
  teamAliases,
  teams,
  venues,
} from "@/lib/db/schema";
import { normalizeTeamName, slugify } from "@/lib/fixtures-paste/normalize";
import type { MatchStatus, OutcomeType, ResultState } from "@/lib/standings";
import { unsafeOrgScope, type OrgScope } from "./organisations";

/*
 * Admin data access. NOT cached (admins must see fresh data, including provisional
 * scores, which the public queries strip). Every function is scoped to an OrgScope
 * that only getCurrentAdmin() hands out; every WHERE includes organisation_id.
 * Mutations accept an optional `db` so tests can run them against PGlite.
 */

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

/** Resolve an organisation id from the session into a scope (null if it no longer exists). */
export async function adminScopeForOrg(
  orgId: string,
  db: Db = getDb(),
): Promise<{ scope: OrgScope; org: { id: string; slug: string; name: string; hashtags: string[] } } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  const [org] = await db
    .select({ id: organisations.id, slug: organisations.slug, name: organisations.name, hashtags: organisations.hashtags })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  return org ? { scope: unsafeOrgScope(org.id, org.slug), org } : null;
}

// ---------------------------------------------------------------------------
// Competitions, entries, venues
// ---------------------------------------------------------------------------

export type AdminEntry = { entryId: string; teamId: string; name: string; shortName: string; aliases: string[] };
export type AdminCompetition = {
  id: string;
  slug: string;
  name: string;
  type: "league" | "knockout" | "group_knockout";
  streamLabel: string | null;
  area: string | null;
  seasonName: string;
  expectedMatchCount: number | null;
  confirmedCount: number;
  entries: AdminEntry[];
};

export async function listCompetitionsForAdmin(scope: OrgScope, db: Db = getDb()): Promise<AdminCompetition[]> {
  const comps = await db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      type: competitions.type,
      streamLabel: competitions.streamLabel,
      area: competitions.area,
      seasonName: seasons.name,
      expectedMatchCount: competitions.expectedMatchCount,
      confirmedCount: sql<number>`(
        select count(*)::int from ${matches}
        where ${matches.competitionId} = ${competitions.id}
          and ${matches.status} = 'completed' and ${matches.resultState} = 'confirmed'
      )`,
    })
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(eq(competitions.organisationId, scope.id))
    .orderBy(sql`${competitions.isFeatured} desc`, sql`${seasons.name} desc`, asc(competitions.sortOrder), asc(competitions.name));

  const entryRows = await db
    .select({
      competitionId: competitionEntries.competitionId,
      entryId: competitionEntries.id,
      teamId: teams.id,
      name: teams.name,
      shortName: teams.shortName,
    })
    .from(competitionEntries)
    .innerJoin(teams, eq(teams.id, competitionEntries.teamId))
    .where(eq(competitionEntries.organisationId, scope.id))
    .orderBy(asc(teams.name));

  const aliasRows = await db
    .select({ teamId: teamAliases.teamId, alias: teamAliases.alias })
    .from(teamAliases)
    .where(eq(teamAliases.organisationId, scope.id));
  const aliasesByTeam = new Map<string, string[]>();
  for (const a of aliasRows) aliasesByTeam.set(a.teamId, [...(aliasesByTeam.get(a.teamId) ?? []), a.alias]);

  return comps.map((c) => ({
    ...c,
    entries: entryRows
      .filter((e) => e.competitionId === c.id)
      .map(({ competitionId: _c, ...e }) => ({ ...e, aliases: aliasesByTeam.get(e.teamId) ?? [] })),
  }));
}

export async function listVenues(scope: OrgScope, db: Db = getDb()) {
  return db
    .select({ id: venues.id, name: venues.name, area: venues.area })
    .from(venues)
    .where(eq(venues.organisationId, scope.id))
    .orderBy(asc(venues.name));
}

/** Find a venue by name or create it. */
export async function ensureVenue(scope: OrgScope, name: string, db: Db = getDb()): Promise<string> {
  const [row] = await db
    .insert(venues)
    .values({ organisationId: scope.id, name })
    .onConflictDoUpdate({ target: [venues.organisationId, venues.name], set: { name } })
    .returning({ id: venues.id });
  return row!.id;
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export type AdminMatch = {
  id: string;
  competitionId: string;
  competitionSlug: string;
  competitionName: string;
  competitionType: "league" | "knockout" | "group_knockout";
  streamLabel: string | null;
  roundLabel: string | null;
  kickoffAt: Date | null;
  kickoffTimeTbc: boolean;
  status: MatchStatus;
  outcomeType: OutcomeType;
  resultState: ResultState;
  homeEntryId: string;
  awayEntryId: string;
  home: { teamId: string; name: string; shortName: string };
  away: { teamId: string; name: string; shortName: string };
  venueName: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  aetHomeGoals: number | null;
  aetAwayGoals: number | null;
  penHome: number | null;
  penAway: number | null;
  winnerEntryId: string | null;
  notes: string | null;
  confirmedAt: Date | null;
};

function adminMatchQuery(db: Db) {
  return db
    .select({
      m: matches,
      competitionSlug: competitions.slug,
      competitionName: competitions.name,
      competitionType: competitions.type,
      streamLabel: competitions.streamLabel,
      venueName: venues.name,
    })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .leftJoin(venues, eq(venues.id, matches.venueId));
}

async function teamNamesByEntry(scope: OrgScope, db: Db) {
  const rows = await db
    .select({ entryId: competitionEntries.id, teamId: teams.id, name: teams.name, shortName: teams.shortName })
    .from(competitionEntries)
    .innerJoin(teams, eq(teams.id, competitionEntries.teamId))
    .where(eq(competitionEntries.organisationId, scope.id));
  return new Map(rows.map((r) => [r.entryId, { teamId: r.teamId, name: r.name, shortName: r.shortName }]));
}

function toAdminMatch(
  row: Awaited<ReturnType<ReturnType<typeof adminMatchQuery>["where"]>>[number],
  names: Map<string, { teamId: string; name: string; shortName: string }>,
): AdminMatch {
  const m = row.m;
  return {
    id: m.id,
    competitionId: m.competitionId,
    competitionSlug: row.competitionSlug,
    competitionName: row.competitionName,
    competitionType: row.competitionType,
    streamLabel: row.streamLabel,
    roundLabel: m.roundLabel,
    kickoffAt: m.kickoffAt,
    kickoffTimeTbc: m.kickoffTimeTbc,
    status: m.status,
    outcomeType: m.outcomeType,
    resultState: m.resultState,
    homeEntryId: m.homeEntryId,
    awayEntryId: m.awayEntryId,
    home: names.get(m.homeEntryId)!,
    away: names.get(m.awayEntryId)!,
    venueName: row.venueName,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    htHomeGoals: m.htHomeGoals,
    htAwayGoals: m.htAwayGoals,
    aetHomeGoals: m.aetHomeGoals,
    aetAwayGoals: m.aetAwayGoals,
    penHome: m.penHome,
    penAway: m.penAway,
    winnerEntryId: m.winnerEntryId,
    notes: m.notes,
    confirmedAt: m.confirmedAt,
  };
}

/** Every match of the organisation, oldest first (organisations are small). */
export async function listAdminMatches(scope: OrgScope, db: Db = getDb()): Promise<AdminMatch[]> {
  const [rows, names] = await Promise.all([
    adminMatchQuery(db)
      .where(eq(matches.organisationId, scope.id))
      .orderBy(asc(matches.kickoffAt), asc(matches.id)),
    teamNamesByEntry(scope, db),
  ]);
  return rows.map((r) => toAdminMatch(r, names));
}

export async function getAdminMatch(scope: OrgScope, matchId: string, db: Db = getDb()): Promise<AdminMatch | null> {
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
  const [rows, names] = await Promise.all([
    adminMatchQuery(db)
      .where(and(eq(matches.organisationId, scope.id), eq(matches.id, matchId)))
      .limit(1),
    teamNamesByEntry(scope, db),
  ]);
  return rows[0] ? toAdminMatch(rows[0], names) : null;
}

/** The columns a result save writes (see lib/match/result-input.ts). */
export type MatchResultPatch = {
  status: MatchStatus;
  outcomeType: OutcomeType;
  resultState: ResultState;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  aetHomeGoals: number | null;
  aetAwayGoals: number | null;
  penHome: number | null;
  penAway: number | null;
  winnerEntryId: string | null;
  confirmedAt: Date | null;
  notes: string | null;
};

/** Update a match's result within the organisation. Returns null if the match isn't in this org. */
export async function saveMatchResult(
  scope: OrgScope,
  matchId: string,
  patch: MatchResultPatch,
  db: Db = getDb(),
): Promise<{ competitionId: string; homeEntryId: string; awayEntryId: string } | null> {
  const [row] = await db
    .update(matches)
    .set(patch)
    .where(and(eq(matches.organisationId, scope.id), eq(matches.id, matchId)))
    .returning({
      competitionId: matches.competitionId,
      homeEntryId: matches.homeEntryId,
      awayEntryId: matches.awayEntryId,
    });
  return row ?? null;
}

export type NewFixture = {
  homeEntryId: string;
  awayEntryId: string;
  kickoffAt: Date;
  kickoffTimeTbc: boolean;
  venueId: string | null;
  roundLabel: string | null;
  roundNumber: number | null;
};

/**
 * Insert fixtures into one competition in a single transaction. Fixtures that
 * already exist (same teams, same SAST date) are skipped, not duplicated.
 * The composite FKs reject entries from another competition or organisation.
 */
export async function insertFixtures(
  scope: OrgScope,
  competitionId: string,
  fixtures: NewFixture[],
  newAliases: { teamId: string; alias: string }[] = [],
  db: Db = getDb(),
): Promise<{ inserted: string[]; skipped: number }> {
  return db.transaction(async (tx) => {
    const [comp] = await tx
      .select({ id: competitions.id })
      .from(competitions)
      .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)))
      .limit(1);
    if (!comp) throw new Error("Competition not found in this organisation");

    const inserted: string[] = [];
    let skipped = 0;
    for (const f of fixtures) {
      const rows = await tx
        .insert(matches)
        .values({ organisationId: scope.id, competitionId, ...f, status: "scheduled" })
        .onConflictDoNothing({
          target: [matches.competitionId, matches.homeEntryId, matches.awayEntryId, matches.kickoffDate],
        })
        .returning({ id: matches.id });
      if (rows[0]) inserted.push(rows[0].id);
      else skipped++;
    }
    for (const a of newAliases) {
      await tx
        .insert(teamAliases)
        .values({ organisationId: scope.id, teamId: a.teamId, alias: a.alias, normalizedAlias: normalizeTeamName(a.alias) })
        .onConflictDoNothing({ target: [teamAliases.teamId, teamAliases.normalizedAlias] });
    }
    return { inserted, skipped };
  });
}

// ---------------------------------------------------------------------------
// Clubs, teams, aliases
// ---------------------------------------------------------------------------

export type AdminTeam = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  category: string;
  gender: "male" | "female" | "mixed" | null;
  logoUrl: string | null;
  clubId: string;
  clubName: string;
  aliases: { id: string; alias: string }[];
};

export async function listTeamsForAdmin(scope: OrgScope, db: Db = getDb()): Promise<AdminTeam[]> {
  const rows = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      name: teams.name,
      shortName: teams.shortName,
      category: teams.category,
      gender: teams.gender,
      logoUrl: teams.logoUrl,
      clubId: clubs.id,
      clubName: clubs.name,
    })
    .from(teams)
    .innerJoin(clubs, eq(clubs.id, teams.clubId))
    .where(eq(teams.organisationId, scope.id))
    .orderBy(asc(teams.name));
  const aliases = await db
    .select({ id: teamAliases.id, teamId: teamAliases.teamId, alias: teamAliases.alias })
    .from(teamAliases)
    .where(eq(teamAliases.organisationId, scope.id))
    .orderBy(asc(teamAliases.alias));
  return rows.map((t) => ({
    ...t,
    aliases: aliases.filter((a) => a.teamId === t.id).map(({ id, alias }) => ({ id, alias })),
  }));
}

export async function listClubs(scope: OrgScope, db: Db = getDb()) {
  return db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(eq(clubs.organisationId, scope.id))
    .orderBy(asc(clubs.name));
}

export type TeamInput = {
  clubId: string | null;
  newClubName: string | null;
  name: string;
  shortName: string;
  category: string;
  gender: "male" | "female" | "mixed" | null;
  logoUrl: string | null;
};

async function resolveClub(scope: OrgScope, input: TeamInput, db: Db): Promise<string> {
  if (input.newClubName) {
    const [row] = await db
      .insert(clubs)
      .values({ organisationId: scope.id, name: input.newClubName })
      .onConflictDoUpdate({ target: [clubs.organisationId, clubs.name], set: { name: input.newClubName } })
      .returning({ id: clubs.id });
    return row!.id;
  }
  const [row] = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(and(eq(clubs.organisationId, scope.id), eq(clubs.id, input.clubId ?? "")))
    .limit(1);
  if (!row) throw new Error("Club not found in this organisation");
  return row.id;
}

/** Unique slug within the organisation: "passion-fc", then "passion-fc-open", "passion-fc-2"… */
async function uniqueTeamSlug(scope: OrgScope, name: string, category: string, db: Db, excludeId?: string) {
  const taken = new Set(
    (
      await db.select({ id: teams.id, slug: teams.slug }).from(teams).where(eq(teams.organisationId, scope.id))
    )
      .filter((t) => t.id !== excludeId)
      .map((t) => t.slug),
  );
  const base = slugify(name) || "team";
  const candidates = [base, `${base}-${slugify(category)}`];
  for (const c of candidates) if (c && !taken.has(c)) return c;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function createTeam(scope: OrgScope, input: TeamInput, db: Db = getDb()): Promise<{ id: string; slug: string }> {
  return db.transaction(async (tx) => {
    const clubId = await resolveClub(scope, input, tx);
    const slug = await uniqueTeamSlug(scope, input.name, input.category, tx);
    const [row] = await tx
      .insert(teams)
      .values({
        organisationId: scope.id,
        clubId,
        name: input.name,
        shortName: input.shortName,
        slug,
        category: input.category,
        gender: input.gender,
        logoUrl: input.logoUrl,
      })
      .returning({ id: teams.id, slug: teams.slug });
    return row!;
  });
}

/** Update a team. The slug (public URL) is kept stable. */
export async function updateTeam(scope: OrgScope, teamId: string, input: TeamInput, db: Db = getDb()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const clubId = await resolveClub(scope, input, tx);
    const rows = await tx
      .update(teams)
      .set({
        clubId,
        name: input.name,
        shortName: input.shortName,
        category: input.category,
        gender: input.gender,
        logoUrl: input.logoUrl,
      })
      .where(and(eq(teams.organisationId, scope.id), eq(teams.id, teamId)))
      .returning({ id: teams.id });
    return rows.length > 0;
  });
}

export async function addTeamAlias(scope: OrgScope, teamId: string, alias: string, db: Db = getDb()): Promise<boolean> {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.organisationId, scope.id), eq(teams.id, teamId)))
    .limit(1);
  if (!team) return false;
  await db
    .insert(teamAliases)
    .values({ organisationId: scope.id, teamId, alias, normalizedAlias: normalizeTeamName(alias) })
    .onConflictDoNothing({ target: [teamAliases.teamId, teamAliases.normalizedAlias] });
  return true;
}

export async function removeTeamAlias(scope: OrgScope, aliasId: string, db: Db = getDb()): Promise<string | null> {
  const [row] = await db
    .delete(teamAliases)
    .where(and(eq(teamAliases.organisationId, scope.id), eq(teamAliases.id, aliasId)))
    .returning({ teamId: teamAliases.teamId });
  return row?.teamId ?? null;
}
