import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  clubs,
  competitionEntries,
  competitionSponsors,
  competitions,
  matches,
  organisations,
  pointsAdjustments,
  seasons,
  sponsors,
  teamAliases,
  teams,
  venues,
} from "@/lib/db/schema";
import { normalizeTeamName, slugify } from "@/lib/fixtures-paste/normalize";
import { parseRules, type CompetitionRules } from "@/lib/rules";

/*
 * Idempotent upserts keyed on natural keys, so `pnpm db:seed` can be re-run safely.
 * Reference data (orgs, teams, competitions…) is updated in place; matches are
 * only inserted, unless `overwriteResults` is set, so results entered in admin
 * are never clobbered by a re-seed.
 */

type OrgInput = typeof organisations.$inferInsert;
type MatchInput = Omit<typeof matches.$inferInsert, "organisationId" | "competitionId">;

export type SeedCounters = { matchesInserted: number; matchesUpdated: number; matchesSkipped: number };

export function newCounters(): SeedCounters {
  return { matchesInserted: 0, matchesUpdated: 0, matchesSkipped: 0 };
}

function one<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`Upsert of ${what} returned no row`);
  return row;
}

export async function upsertOrganisation(db: Db, input: OrgInput) {
  const { slug, ...rest } = input;
  return one(
    await db
      .insert(organisations)
      .values(input)
      .onConflictDoUpdate({ target: organisations.slug, set: rest })
      .returning({ id: organisations.id, slug: organisations.slug }),
    `organisation ${slug}`,
  );
}

export async function upsertSeason(db: Db, organisationId: string, name: string) {
  return one(
    await db
      .insert(seasons)
      .values({ organisationId, name })
      .onConflictDoUpdate({ target: [seasons.organisationId, seasons.name], set: { name } })
      .returning({ id: seasons.id }),
    `season ${name}`,
  );
}

export async function upsertVenue(db: Db, organisationId: string, input: { name: string; area?: string | null }) {
  return one(
    await db
      .insert(venues)
      .values({ organisationId, ...input })
      .onConflictDoUpdate({ target: [venues.organisationId, venues.name], set: { area: input.area ?? null } })
      .returning({ id: venues.id }),
    `venue ${input.name}`,
  );
}

export type TeamSeed = {
  club: string;
  name: string;
  shortName: string;
  category: string;
  gender?: "male" | "female" | "mixed" | null;
  aliases?: string[];
  slug?: string;
};

/** Upserts the club, the team and its aliases. Returns the team id. */
export async function upsertTeam(db: Db, organisationId: string, input: TeamSeed): Promise<string> {
  const club = one(
    await db
      .insert(clubs)
      .values({ organisationId, name: input.club })
      .onConflictDoUpdate({ target: [clubs.organisationId, clubs.name], set: { name: input.club } })
      .returning({ id: clubs.id }),
    `club ${input.club}`,
  );

  const slug = input.slug ?? slugify(input.name);
  const team = one(
    await db
      .insert(teams)
      .values({
        organisationId,
        clubId: club.id,
        name: input.name,
        shortName: input.shortName,
        slug,
        category: input.category,
        gender: input.gender ?? null,
      })
      .onConflictDoUpdate({
        target: [teams.organisationId, teams.slug],
        set: {
          clubId: club.id,
          name: input.name,
          shortName: input.shortName,
          category: input.category,
          gender: input.gender ?? null,
        },
      })
      .returning({ id: teams.id }),
    `team ${input.name}`,
  );

  for (const alias of input.aliases ?? []) {
    await db
      .insert(teamAliases)
      .values({ organisationId, teamId: team.id, alias, normalizedAlias: normalizeTeamName(alias) })
      .onConflictDoNothing({ target: [teamAliases.teamId, teamAliases.normalizedAlias] });
  }
  return team.id;
}

export async function upsertCompetition(
  db: Db,
  input: {
    organisationId: string;
    seasonId: string;
    name: string;
    slug: string;
    type: "league" | "knockout" | "group_knockout";
    streamLabel?: string | null;
    area?: string | null;
    slogan?: string | null;
    logoUrl?: string | null;
    rules?: Partial<CompetitionRules>;
    expectedMatchCount?: number | null;
    isFeatured?: boolean;
    sortOrder?: number;
  },
) {
  const values = {
    ...input,
    streamLabel: input.streamLabel ?? null,
    area: input.area ?? null,
    slogan: input.slogan ?? null,
    logoUrl: input.logoUrl ?? null,
    rules: parseRules(input.rules ?? {}),
    expectedMatchCount: input.expectedMatchCount ?? null,
    isFeatured: input.isFeatured ?? false,
    sortOrder: input.sortOrder ?? 0,
  };
  const { organisationId: _org, slug: _slug, ...set } = values;
  return one(
    await db
      .insert(competitions)
      .values(values)
      .onConflictDoUpdate({ target: [competitions.organisationId, competitions.slug], set })
      .returning({ id: competitions.id }),
    `competition ${input.slug}`,
  );
}

/** Registers teams in a competition. Returns a map teamId → entryId. */
export async function upsertEntries(
  db: Db,
  organisationId: string,
  competitionId: string,
  teamIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const teamId of teamIds) {
    const entry = one(
      await db
        .insert(competitionEntries)
        .values({ organisationId, competitionId, teamId })
        .onConflictDoUpdate({
          target: [competitionEntries.competitionId, competitionEntries.teamId],
          set: { teamId },
        })
        .returning({ id: competitionEntries.id }),
      `entry ${teamId}`,
    );
    map.set(teamId, entry.id);
  }
  return map;
}

export async function upsertSponsors(
  db: Db,
  organisationId: string,
  competitionId: string,
  names: string[],
) {
  for (const [i, name] of names.entries()) {
    const sponsor = one(
      await db
        .insert(sponsors)
        .values({ organisationId, name, sortOrder: i })
        .onConflictDoUpdate({ target: [sponsors.organisationId, sponsors.name], set: { sortOrder: i } })
        .returning({ id: sponsors.id }),
      `sponsor ${name}`,
    );
    await db
      .insert(competitionSponsors)
      .values({ organisationId, competitionId, sponsorId: sponsor.id, sortOrder: i })
      .onConflictDoUpdate({
        target: [competitionSponsors.competitionId, competitionSponsors.sponsorId],
        set: { sortOrder: i },
      });
  }
}

export async function upsertPointsAdjustment(
  db: Db,
  input: typeof pointsAdjustments.$inferInsert,
) {
  await db
    .insert(pointsAdjustments)
    .values(input)
    .onConflictDoUpdate({
      target: [pointsAdjustments.entryId, pointsAdjustments.effectiveOn, pointsAdjustments.reason],
      set: { points: input.points },
    });
}

/**
 * Insert a match keyed on (competition, home entry, away entry, SAST kickoff date).
 * Existing matches are skipped unless `overwrite` is true.
 */
export async function upsertMatch(
  db: Db,
  organisationId: string,
  competitionId: string,
  input: MatchInput,
  opts: { overwrite: boolean; counters: SeedCounters },
) {
  const values = { organisationId, competitionId, ...input };
  const target = [matches.competitionId, matches.homeEntryId, matches.awayEntryId, matches.kickoffDate];

  if (opts.overwrite) {
    const { homeEntryId: _h, awayEntryId: _a, ...set } = input;
    // xmax = 0 only for freshly inserted rows: lets us report inserted vs updated.
    const rows = await db
      .insert(matches)
      .values(values)
      .onConflictDoUpdate({ target, set })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (rows[0]?.inserted) opts.counters.matchesInserted++;
    else opts.counters.matchesUpdated++;
    return;
  }

  const rows = await db.insert(matches).values(values).onConflictDoNothing({ target }).returning({ id: matches.id });
  if (rows.length > 0) opts.counters.matchesInserted++;
  else opts.counters.matchesSkipped++;
}

/** Count matches in a competition (used for seed summaries and tests). */
export async function countMatches(db: Db, competitionId: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(matches)
    .where(and(eq(matches.competitionId, competitionId)));
  return rows[0]?.n ?? 0;
}
