import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { competitionEntries, competitions, matches, pointsAdjustments, seasons, teams } from "@/lib/db/schema";
import { defaultShortName, type AdjustmentInput, type CompetitionCreateInput, type CompetitionUpdateInput } from "@/lib/competitions/input";
import { parseRules, type CompetitionRules } from "@/lib/rules";
import { createTeam } from "./admin";
import type { OrgScope } from "./organisations";

// Correlated count subqueries name their tables explicitly: in a single-table select Drizzle
// renders columns unqualified, so ${matches.competitionId} = ${competitions.id} would compare
// two columns of the inner table.

/*
 * Competition setup for organisation admins: seasons, competitions, rules, team entries and
 * points adjustments. Every function is scoped to an OrgScope, and every WHERE includes
 * organisation_id; the composite FKs reject cross-organisation rows as a second line of defence.
 */

export async function listSeasons(scope: OrgScope, db: Db = getDb()) {
  return db
    .select({ id: seasons.id, name: seasons.name })
    .from(seasons)
    .where(eq(seasons.organisationId, scope.id))
    .orderBy(desc(seasons.name));
}

export type SetupCompetitionSummary = {
  id: string;
  slug: string;
  name: string;
  type: "league" | "knockout" | "group_knockout";
  streamLabel: string | null;
  seasonName: string;
  isFeatured: boolean;
  rulesConfirmed: boolean;
  entryCount: number;
  matchCount: number;
};

export async function listCompetitionsForSetup(scope: OrgScope, db: Db = getDb()): Promise<SetupCompetitionSummary[]> {
  const rows = await db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      type: competitions.type,
      streamLabel: competitions.streamLabel,
      seasonName: seasons.name,
      isFeatured: competitions.isFeatured,
      rules: competitions.rules,
      entryCount: sql<number>`(select count(*)::int from competition_entries e where e.competition_id = "competitions"."id")`,
      matchCount: sql<number>`(select count(*)::int from matches m where m.competition_id = "competitions"."id")`,
    })
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(eq(competitions.organisationId, scope.id))
    .orderBy(desc(seasons.name), desc(competitions.isFeatured), asc(competitions.sortOrder), asc(competitions.name));
  return rows.map(({ rules, ...c }) => ({ ...c, rulesConfirmed: parseRules(rules).confirmed }));
}

async function ensureSeason(scope: OrgScope, name: string, db: Db): Promise<string> {
  const [row] = await db
    .insert(seasons)
    .values({ organisationId: scope.id, name })
    .onConflictDoUpdate({ target: [seasons.organisationId, seasons.name], set: { name } })
    .returning({ id: seasons.id });
  return row!.id;
}

/** At most one featured competition per organisation (it leads the public home page). */
async function unfeatureOthers(scope: OrgScope, keepId: string, db: Db) {
  await db
    .update(competitions)
    .set({ isFeatured: false })
    .where(and(eq(competitions.organisationId, scope.id), ne(competitions.id, keepId)));
}

function settingsValues(input: CompetitionUpdateInput) {
  return {
    name: input.name,
    streamLabel: input.streamLabel,
    area: input.area,
    slogan: input.slogan,
    logoUrl: input.logoUrl,
    expectedMatchCount: input.expectedMatchCount,
    isFeatured: input.isFeatured,
  };
}

export async function createCompetition(
  scope: OrgScope,
  input: CompetitionCreateInput,
  db: Db = getDb(),
): Promise<{ ok: true; id: string } | { ok: false; error: "slug-taken" }> {
  return db.transaction(async (tx) => {
    const seasonId = await ensureSeason(scope, input.season, tx);
    const [existing] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(competitions)
      .where(eq(competitions.organisationId, scope.id));
    const [row] = await tx
      .insert(competitions)
      .values({
        ...settingsValues(input),
        organisationId: scope.id,
        seasonId,
        slug: input.slug,
        type: input.type,
        socialLinks: input.facebook ? { facebook: input.facebook } : {},
        rules: parseRules({}),
        // The first competition leads the public home page.
        isFeatured: input.isFeatured || existing!.n === 0,
        expectedMatchCount: input.type === "league" ? input.expectedMatchCount : null,
      })
      .onConflictDoNothing({ target: [competitions.organisationId, competitions.slug] })
      .returning({ id: competitions.id, isFeatured: competitions.isFeatured });
    if (!row) return { ok: false, error: "slug-taken" } as const;
    if (row.isFeatured) await unfeatureOthers(scope, row.id, tx);
    return { ok: true, id: row.id } as const;
  });
}

export async function updateCompetition(
  scope: OrgScope,
  competitionId: string,
  input: CompetitionUpdateInput,
  db: Db = getDb(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ socialLinks: competitions.socialLinks, type: competitions.type })
      .from(competitions)
      .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)))
      .limit(1);
    if (!current) return false;
    const { facebook: _old, ...otherLinks } = current.socialLinks;
    await tx
      .update(competitions)
      .set({
        ...settingsValues(input),
        expectedMatchCount: current.type === "league" ? input.expectedMatchCount : null,
        socialLinks: input.facebook ? { ...otherLinks, facebook: input.facebook } : otherLinks,
      })
      .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)));
    if (input.isFeatured) await unfeatureOthers(scope, competitionId, tx);
    return true;
  });
}

export async function updateCompetitionRules(
  scope: OrgScope,
  competitionId: string,
  rules: CompetitionRules,
  db: Db = getDb(),
): Promise<boolean> {
  const rows = await db
    .update(competitions)
    .set({ rules: parseRules(rules) })
    .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)))
    .returning({ id: competitions.id });
  return rows.length > 0;
}

/** Delete a competition that has no matches yet (e.g. created by mistake). */
export async function deleteCompetition(
  scope: OrgScope,
  competitionId: string,
  db: Db = getDb(),
): Promise<"deleted" | "has-matches" | "not-found"> {
  return db.transaction(async (tx) => {
    const [comp] = await tx
      .select({
        id: competitions.id,
        matchCount: sql<number>`(select count(*)::int from matches m where m.competition_id = "competitions"."id")`,
      })
      .from(competitions)
      .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)))
      .limit(1);
    if (!comp) return "not-found";
    if (comp.matchCount > 0) return "has-matches";
    await tx.delete(pointsAdjustments).where(eq(pointsAdjustments.competitionId, comp.id));
    await tx.delete(competitionEntries).where(eq(competitionEntries.competitionId, comp.id));
    await tx.delete(competitions).where(eq(competitions.id, comp.id));
    return "deleted";
  });
}

// ---------------------------------------------------------------------------
// One competition: settings, entries, adjustments
// ---------------------------------------------------------------------------

export type SetupEntry = { entryId: string; teamId: string; name: string; category: string; matchCount: number };
export type SetupAdjustment = { id: string; entryId: string; teamName: string; points: number; reason: string; effectiveOn: string };

export async function getCompetitionForSetup(scope: OrgScope, competitionId: string, db: Db = getDb()) {
  if (!/^[0-9a-f-]{36}$/i.test(competitionId)) return null;
  const [comp] = await db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      type: competitions.type,
      streamLabel: competitions.streamLabel,
      area: competitions.area,
      slogan: competitions.slogan,
      logoUrl: competitions.logoUrl,
      socialLinks: competitions.socialLinks,
      rules: competitions.rules,
      expectedMatchCount: competitions.expectedMatchCount,
      isFeatured: competitions.isFeatured,
      seasonName: seasons.name,
    })
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)))
    .limit(1);
  if (!comp) return null;

  const entries: SetupEntry[] = await db
    .select({
      entryId: competitionEntries.id,
      teamId: teams.id,
      name: teams.name,
      category: teams.category,
      matchCount: sql<number>`(select count(*)::int from matches m where m.home_entry_id = "competition_entries"."id" or m.away_entry_id = "competition_entries"."id")`,
    })
    .from(competitionEntries)
    .innerJoin(teams, eq(teams.id, competitionEntries.teamId))
    .where(and(eq(competitionEntries.organisationId, scope.id), eq(competitionEntries.competitionId, comp.id)))
    .orderBy(asc(teams.name));

  const adjustments: SetupAdjustment[] = await db
    .select({
      id: pointsAdjustments.id,
      entryId: pointsAdjustments.entryId,
      teamName: teams.name,
      points: pointsAdjustments.points,
      reason: pointsAdjustments.reason,
      effectiveOn: pointsAdjustments.effectiveOn,
    })
    .from(pointsAdjustments)
    .innerJoin(competitionEntries, eq(competitionEntries.id, pointsAdjustments.entryId))
    .innerJoin(teams, eq(teams.id, competitionEntries.teamId))
    .where(and(eq(pointsAdjustments.organisationId, scope.id), eq(pointsAdjustments.competitionId, comp.id)))
    .orderBy(asc(pointsAdjustments.effectiveOn));

  return { competition: { ...comp, rules: parseRules(comp.rules) }, entries, adjustments };
}

async function competitionInOrg(scope: OrgScope, competitionId: string, db: Db) {
  const [comp] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(and(eq(competitions.organisationId, scope.id), eq(competitions.id, competitionId)))
    .limit(1);
  return comp ?? null;
}

/** Enter existing teams (of this organisation) into a competition. Returns the team ids entered. */
export async function addEntries(
  scope: OrgScope,
  competitionId: string,
  teamIds: string[],
  db: Db = getDb(),
): Promise<string[] | null> {
  if (!teamIds.length) return [];
  return db.transaction(async (tx) => {
    if (!(await competitionInOrg(scope, competitionId, tx))) return null;
    const own = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.organisationId, scope.id), inArray(teams.id, teamIds)));
    if (!own.length) return [];
    const rows = await tx
      .insert(competitionEntries)
      .values(own.map((t) => ({ organisationId: scope.id, competitionId, teamId: t.id })))
      .onConflictDoNothing({ target: [competitionEntries.competitionId, competitionEntries.teamId] })
      .returning({ teamId: competitionEntries.teamId });
    return rows.map((r) => r.teamId);
  });
}

/**
 * Create teams from pasted names and enter them. Names that match an existing team in this
 * organisation (same name, any case) reuse that team instead of creating a duplicate.
 */
export async function createTeamsAndEnter(
  scope: OrgScope,
  competitionId: string,
  names: string[],
  category: string,
  db: Db = getDb(),
): Promise<{ created: number; reused: number } | null> {
  return db.transaction(async (tx) => {
    if (!(await competitionInOrg(scope, competitionId, tx))) return null;
    const existing = await tx
      .select({ id: teams.id, name: teams.name, category: teams.category })
      .from(teams)
      .where(eq(teams.organisationId, scope.id));
    const byName = new Map(
      existing.filter((t) => t.category.toLowerCase() === category.toLowerCase()).map((t) => [t.name.toLowerCase(), t.id]),
    );
    const teamIds = new Set<string>();
    let created = 0;
    for (const name of names) {
      const found = byName.get(name.toLowerCase());
      if (found) {
        teamIds.add(found);
        continue;
      }
      const team = await createTeam(
        scope,
        { clubId: null, newClubName: name, name, shortName: defaultShortName(name), category, gender: null, logoUrl: null },
        tx,
      );
      byName.set(name.toLowerCase(), team.id);
      teamIds.add(team.id);
      created++;
    }
    await tx
      .insert(competitionEntries)
      .values([...teamIds].map((teamId) => ({ organisationId: scope.id, competitionId, teamId })))
      .onConflictDoNothing({ target: [competitionEntries.competitionId, competitionEntries.teamId] });
    return { created, reused: teamIds.size - created };
  });
}

/** Take a team out of a competition. Only allowed before it has any matches there. */
export async function removeEntry(
  scope: OrgScope,
  competitionId: string,
  entryId: string,
  db: Db = getDb(),
): Promise<{ result: "removed"; teamId: string } | { result: "has-matches" | "not-found" }> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select({ id: competitionEntries.id, teamId: competitionEntries.teamId })
      .from(competitionEntries)
      .where(
        and(
          eq(competitionEntries.organisationId, scope.id),
          eq(competitionEntries.competitionId, competitionId),
          eq(competitionEntries.id, entryId),
        ),
      )
      .limit(1);
    if (!entry) return { result: "not-found" } as const;
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(matches)
      .where(or(eq(matches.homeEntryId, entry.id), eq(matches.awayEntryId, entry.id)));
    if (used!.n > 0) return { result: "has-matches" } as const;
    await tx.delete(pointsAdjustments).where(eq(pointsAdjustments.entryId, entry.id));
    await tx.delete(competitionEntries).where(eq(competitionEntries.id, entry.id));
    return { result: "removed", teamId: entry.teamId } as const;
  });
}

export async function addPointsAdjustment(
  scope: OrgScope,
  competitionId: string,
  input: AdjustmentInput,
  db: Db = getDb(),
): Promise<"added" | "duplicate" | "not-found"> {
  const [entry] = await db
    .select({ id: competitionEntries.id })
    .from(competitionEntries)
    .where(
      and(
        eq(competitionEntries.organisationId, scope.id),
        eq(competitionEntries.competitionId, competitionId),
        eq(competitionEntries.id, input.entryId),
      ),
    )
    .limit(1);
  if (!entry) return "not-found";
  const rows = await db
    .insert(pointsAdjustments)
    .values({ organisationId: scope.id, competitionId, ...input })
    .onConflictDoNothing({ target: [pointsAdjustments.entryId, pointsAdjustments.effectiveOn, pointsAdjustments.reason] })
    .returning({ id: pointsAdjustments.id });
  return rows.length ? "added" : "duplicate";
}

export async function removePointsAdjustment(
  scope: OrgScope,
  competitionId: string,
  adjustmentId: string,
  db: Db = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(pointsAdjustments)
    .where(
      and(
        eq(pointsAdjustments.organisationId, scope.id),
        eq(pointsAdjustments.competitionId, competitionId),
        eq(pointsAdjustments.id, adjustmentId),
      ),
    )
    .returning({ id: pointsAdjustments.id });
  return rows.length > 0;
}
