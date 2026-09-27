CREATE TYPE "public"."competition_type" AS ENUM('league', 'knockout', 'group_knockout');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'postponed', 'cancelled', 'abandoned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."outcome_type" AS ENUM('normal', 'walkover', 'awarded');--> statement-breakpoint
CREATE TYPE "public"."result_state" AS ENUM('provisional', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."team_gender" AS ENUM('male', 'female', 'mixed');--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_org_name_uq" UNIQUE("organisation_id","name"),
	CONSTRAINT "clubs_id_org_uq" UNIQUE("id","organisation_id")
);
--> statement-breakpoint
CREATE TABLE "competition_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"display_name" text,
	"group_label" text,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_entries_competition_team_uq" UNIQUE("competition_id","team_id"),
	CONSTRAINT "competition_entries_id_competition_uq" UNIQUE("id","competition_id")
);
--> statement-breakpoint
CREATE TABLE "competition_sponsors" (
	"organisation_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "competition_sponsors_pk" PRIMARY KEY("competition_id","sponsor_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "competition_type" NOT NULL,
	"stream_label" text,
	"slogan" text,
	"logo_url" text,
	"rules" jsonb NOT NULL,
	"expected_match_count" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_org_slug_uq" UNIQUE("organisation_id","slug"),
	CONSTRAINT "competitions_id_org_uq" UNIQUE("id","organisation_id"),
	CONSTRAINT "competitions_expected_match_count_positive" CHECK (expected_match_count IS NULL OR expected_match_count > 0)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"round_label" text,
	"round_number" integer,
	"home_entry_id" uuid NOT NULL,
	"away_entry_id" uuid NOT NULL,
	"venue_id" uuid,
	"kickoff_at" timestamp with time zone,
	"kickoff_time_tbc" boolean DEFAULT false NOT NULL,
	"kickoff_date" date GENERATED ALWAYS AS (((kickoff_at AT TIME ZONE 'Africa/Johannesburg')::date)) STORED,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"outcome_type" "outcome_type" DEFAULT 'normal' NOT NULL,
	"home_goals" smallint,
	"away_goals" smallint,
	"ht_home_goals" smallint,
	"ht_away_goals" smallint,
	"aet_home_goals" smallint,
	"aet_away_goals" smallint,
	"pen_home" smallint,
	"pen_away" smallint,
	"winner_entry_id" uuid,
	"result_state" "result_state" DEFAULT 'provisional' NOT NULL,
	"notes" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_natural_key_uq" UNIQUE("competition_id","home_entry_id","away_entry_id","kickoff_date"),
	CONSTRAINT "matches_home_ne_away" CHECK (home_entry_id <> away_entry_id),
	CONSTRAINT "matches_scores_non_negative" CHECK ((home_goals IS NULL OR home_goals >= 0) AND (away_goals IS NULL OR away_goals >= 0)
        AND (ht_home_goals IS NULL OR ht_home_goals >= 0) AND (ht_away_goals IS NULL OR ht_away_goals >= 0)
        AND (aet_home_goals IS NULL OR aet_home_goals >= 0) AND (aet_away_goals IS NULL OR aet_away_goals >= 0)
        AND (pen_home IS NULL OR pen_home >= 0) AND (pen_away IS NULL OR pen_away >= 0)),
	CONSTRAINT "matches_ft_pair" CHECK ((home_goals IS NULL) = (away_goals IS NULL)),
	CONSTRAINT "matches_ht_pair" CHECK ((ht_home_goals IS NULL) = (ht_away_goals IS NULL)),
	CONSTRAINT "matches_aet_pair" CHECK ((aet_home_goals IS NULL) = (aet_away_goals IS NULL)),
	CONSTRAINT "matches_pen_pair" CHECK ((pen_home IS NULL) = (pen_away IS NULL)),
	CONSTRAINT "matches_ht_requires_ft" CHECK (ht_home_goals IS NULL OR (home_goals IS NOT NULL AND ht_home_goals <= home_goals AND ht_away_goals <= away_goals)),
	CONSTRAINT "matches_aet_only_after_level_ft" CHECK (aet_home_goals IS NULL OR (home_goals = away_goals AND aet_home_goals >= home_goals AND aet_away_goals >= away_goals)),
	CONSTRAINT "matches_pens_only_when_level" CHECK (pen_home IS NULL OR (home_goals IS NOT NULL
        AND COALESCE(aet_home_goals, home_goals) = COALESCE(aet_away_goals, away_goals)
        AND pen_home <> pen_away)),
	CONSTRAINT "matches_winner_is_participant" CHECK (winner_entry_id IS NULL OR winner_entry_id = home_entry_id OR winner_entry_id = away_entry_id),
	CONSTRAINT "matches_completed_has_score" CHECK (NOT (status = 'completed' AND outcome_type IN ('normal', 'awarded')) OR home_goals IS NOT NULL),
	CONSTRAINT "matches_walkover_shape" CHECK (outcome_type <> 'walkover' OR (status = 'completed' AND winner_entry_id IS NOT NULL
        AND home_goals IS NULL AND ht_home_goals IS NULL AND aet_home_goals IS NULL AND pen_home IS NULL)),
	CONSTRAINT "matches_completed_has_kickoff" CHECK (status <> 'completed' OR kickoff_at IS NOT NULL),
	CONSTRAINT "matches_confirmed_has_timestamp" CHECK (result_state <> 'confirmed' OR confirmed_at IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"logo_url" text,
	"primary_color" text NOT NULL,
	"secondary_color" text NOT NULL,
	"accent_color" text,
	"text_color" text DEFAULT '#111111' NOT NULL,
	"background_color" text DEFAULT '#F4F4F2' NOT NULL,
	"tagline" text,
	"hashtags" text[] DEFAULT '{}'::text[] NOT NULL,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organisations_primary_color_hex" CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "organisations_secondary_color_hex" CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "organisations_accent_color_hex" CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "organisations_text_color_hex" CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "organisations_background_color_hex" CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "points_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"effective_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_adjustments_natural_key_uq" UNIQUE("entry_id","effective_on","reason"),
	CONSTRAINT "points_adjustments_nonzero" CHECK (points <> 0),
	CONSTRAINT "points_adjustments_reason_present" CHECK (length(trim(reason)) > 0)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_org_name_uq" UNIQUE("organisation_id","name"),
	CONSTRAINT "seasons_id_org_uq" UNIQUE("id","organisation_id"),
	CONSTRAINT "seasons_dates_ordered" CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsors_org_name_uq" UNIQUE("organisation_id","name"),
	CONSTRAINT "sponsors_id_org_uq" UNIQUE("id","organisation_id")
);
--> statement-breakpoint
CREATE TABLE "team_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_aliases_team_alias_uq" UNIQUE("team_id","normalized_alias")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"gender" "team_gender",
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_org_slug_uq" UNIQUE("organisation_id","slug"),
	CONSTRAINT "teams_id_org_uq" UNIQUE("id","organisation_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"map_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_org_name_uq" UNIQUE("organisation_id","name"),
	CONSTRAINT "venues_id_org_uq" UNIQUE("id","organisation_id")
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competition_fk" FOREIGN KEY ("competition_id","organisation_id") REFERENCES "public"."competitions"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_team_fk" FOREIGN KEY ("team_id","organisation_id") REFERENCES "public"."teams"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_sponsors" ADD CONSTRAINT "competition_sponsors_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_sponsors" ADD CONSTRAINT "competition_sponsors_competition_fk" FOREIGN KEY ("competition_id","organisation_id") REFERENCES "public"."competitions"("id","organisation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_sponsors" ADD CONSTRAINT "competition_sponsors_sponsor_fk" FOREIGN KEY ("sponsor_id","organisation_id") REFERENCES "public"."sponsors"("id","organisation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_fk" FOREIGN KEY ("season_id","organisation_id") REFERENCES "public"."seasons"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_fk" FOREIGN KEY ("competition_id","organisation_id") REFERENCES "public"."competitions"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_entry_fk" FOREIGN KEY ("home_entry_id","competition_id") REFERENCES "public"."competition_entries"("id","competition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_entry_fk" FOREIGN KEY ("away_entry_id","competition_id") REFERENCES "public"."competition_entries"("id","competition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_fk" FOREIGN KEY ("venue_id","organisation_id") REFERENCES "public"."venues"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_adjustments" ADD CONSTRAINT "points_adjustments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_adjustments" ADD CONSTRAINT "points_adjustments_competition_fk" FOREIGN KEY ("competition_id","organisation_id") REFERENCES "public"."competitions"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_adjustments" ADD CONSTRAINT "points_adjustments_entry_fk" FOREIGN KEY ("entry_id","competition_id") REFERENCES "public"."competition_entries"("id","competition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_aliases" ADD CONSTRAINT "team_aliases_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_aliases" ADD CONSTRAINT "team_aliases_team_fk" FOREIGN KEY ("team_id","organisation_id") REFERENCES "public"."teams"("id","organisation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_fk" FOREIGN KEY ("club_id","organisation_id") REFERENCES "public"."clubs"("id","organisation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_entries_team_idx" ON "competition_entries" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "matches_competition_kickoff_idx" ON "matches" USING btree ("competition_id","kickoff_at");--> statement-breakpoint
CREATE INDEX "matches_org_kickoff_idx" ON "matches" USING btree ("organisation_id","kickoff_at");--> statement-breakpoint
CREATE INDEX "matches_home_entry_idx" ON "matches" USING btree ("home_entry_id");--> statement-breakpoint
CREATE INDEX "matches_away_entry_idx" ON "matches" USING btree ("away_entry_id");--> statement-breakpoint
CREATE INDEX "matches_competition_state_idx" ON "matches" USING btree ("competition_id","status","result_state");--> statement-breakpoint
CREATE INDEX "points_adjustments_competition_idx" ON "points_adjustments" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "team_aliases_org_alias_idx" ON "team_aliases" USING btree ("organisation_id","normalized_alias");--> statement-breakpoint
CREATE INDEX "teams_club_idx" ON "teams" USING btree ("club_id");