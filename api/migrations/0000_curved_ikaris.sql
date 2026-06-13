CREATE SCHEMA IF NOT EXISTS "sonora";
--> statement-breakpoint
CREATE TABLE "sonora"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"message" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "sonora"."trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"audio_url" text NOT NULL,
	"feedback_trigger" text,
	CONSTRAINT "trips_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sonora"."feedback" ADD CONSTRAINT "feedback_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "sonora"."trips"("id") ON DELETE no action ON UPDATE no action;