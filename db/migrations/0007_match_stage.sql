CREATE TYPE "public"."match_stage" AS ENUM('group', 'knockout');--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "stage" "match_stage";