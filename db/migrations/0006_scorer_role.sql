ALTER TYPE "public"."member_role" ADD VALUE 'scorer';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "result_entered_by" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_result_entered_by_users_id_fk" FOREIGN KEY ("result_entered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;