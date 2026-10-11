CREATE TYPE "sonora"."lead_source" AS ENUM('track_detail', 'trip_detail');--> statement-breakpoint
CREATE TABLE "sonora"."leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"experience_id" uuid,
	"source" "sonora"."lead_source" NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sonora"."leads" ADD CONSTRAINT "leads_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;