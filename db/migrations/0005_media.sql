CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_org_sha256_uq" UNIQUE("organisation_id","sha256"),
	CONSTRAINT "media_content_type" CHECK (content_type IN ('image/png', 'image/jpeg')),
	CONSTRAINT "media_size" CHECK (byte_size > 0 AND byte_size <= 1500000)
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;