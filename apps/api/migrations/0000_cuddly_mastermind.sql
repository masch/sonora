CREATE SCHEMA "sonora";
--> statement-breakpoint
CREATE TABLE "sonora"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"message" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "sonora"."tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"audio_url" text NOT NULL,
	"feedback_trigger" text,
	CONSTRAINT "tracks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sonora"."feedback" ADD CONSTRAINT "feedback_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "sonora"."tracks"("id") ON DELETE no action ON UPDATE no action;