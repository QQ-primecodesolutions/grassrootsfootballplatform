import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { CompetitionRules } from "@/lib/rules";

/*
 * Tenancy: every tenant-owned table carries organisation_id. Parent tables expose
 * UNIQUE (id, organisation_id) and children reference them with composite FKs, so
 * a row can never point at another organisation's data, even if app code is wrong.
 *
 * No player or person data lives here (see CLAUDE.md).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const competitionType = pgEnum("competition_type", ["league", "knockout", "group_knockout"]);
export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "postponed",
  "cancelled",
  "abandoned",
  "completed",
]);
export const outcomeType = pgEnum("outcome_type", ["normal", "walkover", "awarded"]);
export const resultState = pgEnum("result_state", ["provisional", "confirmed"]);
export const teamGender = pgEnum("team_gender", ["male", "female", "mixed"]);

// ---------------------------------------------------------------------------
// Shared columns
// ---------------------------------------------------------------------------

const id = () => uuid("id").primaryKey().defaultRandom();

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const hexColor = (column: string) => sql.raw(`${column} ~ '^#[0-9A-Fa-f]{6}$'`);

export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  whatsapp?: string;
  website?: string;
};

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export const organisations = pgTable(
  "organisations",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color").notNull(),
    secondaryColor: text("secondary_color").notNull(),
    accentColor: text("accent_color"),
    textColor: text("text_color").notNull().default("#111111"),
    backgroundColor: text("background_color").notNull().default("#F4F4F2"),
    tagline: text("tagline"),
    hashtags: text("hashtags").array().notNull().default(sql`'{}'::text[]`),
    socialLinks: jsonb("social_links").$type<SocialLinks>().notNull().default({}),
    ...timestamps,
  },
  () => [
    check("organisations_primary_color_hex", hexColor("primary_color")),
    check("organisations_secondary_color_hex", hexColor("secondary_color")),
    check("organisations_accent_color_hex", sql`accent_color IS NULL OR ${hexColor("accent_color")}`),
    check("organisations_text_color_hex", hexColor("text_color")),
    check("organisations_background_color_hex", hexColor("background_color")),
  ],
);

// ---------------------------------------------------------------------------
// Clubs, teams, aliases
// ---------------------------------------------------------------------------

export const clubs = pgTable(
  "clubs",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    name: text("name").notNull(),
    shortName: text("short_name"),
    logoUrl: text("logo_url"),
    ...timestamps,
  },
  (t) => [
    unique("clubs_org_name_uq").on(t.organisationId, t.name),
    unique("clubs_id_org_uq").on(t.id, t.organisationId),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    clubId: uuid("club_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull(),
    /** Null = not yet confirmed by the organiser. */
    gender: teamGender("gender"),
    logoUrl: text("logo_url"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "teams_club_fk",
      columns: [t.clubId, t.organisationId],
      foreignColumns: [clubs.id, clubs.organisationId],
    }),
    unique("teams_org_slug_uq").on(t.organisationId, t.slug),
    unique("teams_id_org_uq").on(t.id, t.organisationId),
    index("teams_club_idx").on(t.clubId),
  ],
);

export const teamAliases = pgTable(
  "team_aliases",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    teamId: uuid("team_id").notNull(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "team_aliases_team_fk",
      columns: [t.teamId, t.organisationId],
      foreignColumns: [teams.id, teams.organisationId],
    }).onDelete("cascade"),
    // Deliberately NOT unique per organisation: "Passion" can fit both Passion teams.
    // Ambiguity is resolved in competition scope when matching pasted fixtures.
    unique("team_aliases_team_alias_uq").on(t.teamId, t.normalizedAlias),
    index("team_aliases_org_alias_idx").on(t.organisationId, t.normalizedAlias),
  ],
);

// ---------------------------------------------------------------------------
// Seasons, competitions, entries, venues
// ---------------------------------------------------------------------------

export const seasons = pgTable(
  "seasons",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    ...timestamps,
  },
  (t) => [
    unique("seasons_org_name_uq").on(t.organisationId, t.name),
    unique("seasons_id_org_uq").on(t.id, t.organisationId),
    check("seasons_dates_ordered", sql`ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on`),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    seasonId: uuid("season_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: competitionType("type").notNull(),
    streamLabel: text("stream_label"),
    /** Where the competition/stream is played, e.g. "Tseki". */
    area: text("area"),
    slogan: text("slogan"),
    logoUrl: text("logo_url"),
    /** The competition brand's own pages (e.g. the QDL Facebook page), shown alongside the org's. */
    socialLinks: jsonb("social_links").$type<SocialLinks>().notNull().default({}),
    /** Validated with lib/rules (zod) on every read and write. */
    rules: jsonb("rules").$type<CompetitionRules>().notNull(),
    /** Planned number of league matches, for "X of N results entered" (null = unknown). */
    expectedMatchCount: integer("expected_match_count"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "competitions_season_fk",
      columns: [t.seasonId, t.organisationId],
      foreignColumns: [seasons.id, seasons.organisationId],
    }),
    unique("competitions_org_slug_uq").on(t.organisationId, t.slug),
    unique("competitions_id_org_uq").on(t.id, t.organisationId),
    check("competitions_expected_match_count_positive", sql`expected_match_count IS NULL OR expected_match_count > 0`),
  ],
);

export const competitionEntries = pgTable(
  "competition_entries",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    competitionId: uuid("competition_id").notNull(),
    teamId: uuid("team_id").notNull(),
    displayName: text("display_name"),
    groupLabel: text("group_label"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "competition_entries_competition_fk",
      columns: [t.competitionId, t.organisationId],
      foreignColumns: [competitions.id, competitions.organisationId],
    }),
    foreignKey({
      name: "competition_entries_team_fk",
      columns: [t.teamId, t.organisationId],
      foreignColumns: [teams.id, teams.organisationId],
    }),
    unique("competition_entries_competition_team_uq").on(t.competitionId, t.teamId),
    // Target for match FKs: guarantees both sides of a match are in the same competition.
    unique("competition_entries_id_competition_uq").on(t.id, t.competitionId),
    index("competition_entries_team_idx").on(t.teamId),
  ],
);

export const venues = pgTable(
  "venues",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    name: text("name").notNull(),
    area: text("area"),
    mapUrl: text("map_url"),
    ...timestamps,
  },
  (t) => [
    unique("venues_org_name_uq").on(t.organisationId, t.name),
    unique("venues_id_org_uq").on(t.id, t.organisationId),
  ],
);

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export const matches = pgTable(
  "matches",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    competitionId: uuid("competition_id").notNull(),
    roundLabel: text("round_label"),
    roundNumber: integer("round_number"),
    homeEntryId: uuid("home_entry_id").notNull(),
    awayEntryId: uuid("away_entry_id").notNull(),
    venueId: uuid("venue_id"),
    /** Null = date to be confirmed. */
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }),
    /** Date known but time not (stored at 00:00 SAST). */
    kickoffTimeTbc: boolean("kickoff_time_tbc").notNull().default(false),
    /** SAST calendar date of kickoff; part of the natural key used by the seed. */
    kickoffDate: date("kickoff_date", { mode: "string" }).generatedAlwaysAs(
      sql`((kickoff_at AT TIME ZONE 'Africa/Johannesburg')::date)`,
    ),
    status: matchStatus("status").notNull().default("scheduled"),
    outcomeType: outcomeType("outcome_type").notNull().default("normal"),
    /** Score at the end of normal time. */
    homeGoals: smallint("home_goals"),
    awayGoals: smallint("away_goals"),
    htHomeGoals: smallint("ht_home_goals"),
    htAwayGoals: smallint("ht_away_goals"),
    /** Cumulative score after extra time. */
    aetHomeGoals: smallint("aet_home_goals"),
    aetAwayGoals: smallint("aet_away_goals"),
    /** Shootout. Never counted as goals. */
    penHome: smallint("pen_home"),
    penAway: smallint("pen_away"),
    winnerEntryId: uuid("winner_entry_id"),
    resultState: resultState("result_state").notNull().default("provisional"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "matches_competition_fk",
      columns: [t.competitionId, t.organisationId],
      foreignColumns: [competitions.id, competitions.organisationId],
    }),
    foreignKey({
      name: "matches_home_entry_fk",
      columns: [t.homeEntryId, t.competitionId],
      foreignColumns: [competitionEntries.id, competitionEntries.competitionId],
    }),
    foreignKey({
      name: "matches_away_entry_fk",
      columns: [t.awayEntryId, t.competitionId],
      foreignColumns: [competitionEntries.id, competitionEntries.competitionId],
    }),
    foreignKey({
      name: "matches_venue_fk",
      columns: [t.venueId, t.organisationId],
      foreignColumns: [venues.id, venues.organisationId],
    }),

    check("matches_home_ne_away", sql`home_entry_id <> away_entry_id`),
    check(
      "matches_scores_non_negative",
      sql`(home_goals IS NULL OR home_goals >= 0) AND (away_goals IS NULL OR away_goals >= 0)
        AND (ht_home_goals IS NULL OR ht_home_goals >= 0) AND (ht_away_goals IS NULL OR ht_away_goals >= 0)
        AND (aet_home_goals IS NULL OR aet_home_goals >= 0) AND (aet_away_goals IS NULL OR aet_away_goals >= 0)
        AND (pen_home IS NULL OR pen_home >= 0) AND (pen_away IS NULL OR pen_away >= 0)`,
    ),
    check("matches_ft_pair", sql`(home_goals IS NULL) = (away_goals IS NULL)`),
    check("matches_ht_pair", sql`(ht_home_goals IS NULL) = (ht_away_goals IS NULL)`),
    check("matches_aet_pair", sql`(aet_home_goals IS NULL) = (aet_away_goals IS NULL)`),
    check("matches_pen_pair", sql`(pen_home IS NULL) = (pen_away IS NULL)`),
    check(
      "matches_ht_requires_ft",
      sql`ht_home_goals IS NULL OR (home_goals IS NOT NULL AND ht_home_goals <= home_goals AND ht_away_goals <= away_goals)`,
    ),
    check(
      "matches_aet_only_after_level_ft",
      sql`aet_home_goals IS NULL OR (home_goals = away_goals AND aet_home_goals >= home_goals AND aet_away_goals >= away_goals)`,
    ),
    check(
      "matches_pens_only_when_level",
      sql`pen_home IS NULL OR (home_goals IS NOT NULL
        AND COALESCE(aet_home_goals, home_goals) = COALESCE(aet_away_goals, away_goals)
        AND pen_home <> pen_away)`,
    ),
    check(
      "matches_winner_is_participant",
      sql`winner_entry_id IS NULL OR winner_entry_id = home_entry_id OR winner_entry_id = away_entry_id`,
    ),
    check(
      "matches_completed_has_score",
      sql`NOT (status = 'completed' AND outcome_type IN ('normal', 'awarded')) OR home_goals IS NOT NULL`,
    ),
    check(
      "matches_walkover_shape",
      sql`outcome_type <> 'walkover' OR (status = 'completed' AND winner_entry_id IS NOT NULL
        AND home_goals IS NULL AND ht_home_goals IS NULL AND aet_home_goals IS NULL AND pen_home IS NULL)`,
    ),
    check("matches_completed_has_kickoff", sql`status <> 'completed' OR kickoff_at IS NOT NULL`),
    check("matches_confirmed_has_timestamp", sql`result_state <> 'confirmed' OR confirmed_at IS NOT NULL`),

    // Natural key: re-running the seed must never duplicate a match.
    unique("matches_natural_key_uq").on(t.competitionId, t.homeEntryId, t.awayEntryId, t.kickoffDate),

    index("matches_competition_kickoff_idx").on(t.competitionId, t.kickoffAt),
    index("matches_org_kickoff_idx").on(t.organisationId, t.kickoffAt),
    index("matches_home_entry_idx").on(t.homeEntryId),
    index("matches_away_entry_idx").on(t.awayEntryId),
    index("matches_competition_state_idx").on(t.competitionId, t.status, t.resultState),
  ],
);

// ---------------------------------------------------------------------------
// Points adjustments, sponsors
// ---------------------------------------------------------------------------

export const pointsAdjustments = pgTable(
  "points_adjustments",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    competitionId: uuid("competition_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "points_adjustments_competition_fk",
      columns: [t.competitionId, t.organisationId],
      foreignColumns: [competitions.id, competitions.organisationId],
    }),
    foreignKey({
      name: "points_adjustments_entry_fk",
      columns: [t.entryId, t.competitionId],
      foreignColumns: [competitionEntries.id, competitionEntries.competitionId],
    }),
    check("points_adjustments_nonzero", sql`points <> 0`),
    check("points_adjustments_reason_present", sql`length(trim(reason)) > 0`),
    unique("points_adjustments_natural_key_uq").on(t.entryId, t.effectiveOn, t.reason),
    index("points_adjustments_competition_idx").on(t.competitionId),
  ],
);

export const sponsors = pgTable(
  "sponsors",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("sponsors_org_name_uq").on(t.organisationId, t.name),
    unique("sponsors_id_org_uq").on(t.id, t.organisationId),
  ],
);

export const competitionSponsors = pgTable(
  "competition_sponsors",
  {
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    competitionId: uuid("competition_id").notNull(),
    sponsorId: uuid("sponsor_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ name: "competition_sponsors_pk", columns: [t.competitionId, t.sponsorId] }),
    foreignKey({
      name: "competition_sponsors_competition_fk",
      columns: [t.competitionId, t.organisationId],
      foreignColumns: [competitions.id, competitions.organisationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "competition_sponsors_sponsor_fk",
      columns: [t.sponsorId, t.organisationId],
      foreignColumns: [sponsors.id, sponsors.organisationId],
    }).onDelete("cascade"),
  ],
);
