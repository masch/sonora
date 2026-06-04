CREATE SCHEMA "sonora";
--> statement-breakpoint
CREATE TABLE "sonora"."feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"message" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "sonora"."trips" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"audio_url" text NOT NULL,
	"feedback_trigger" text
);
--> statement-breakpoint
ALTER TABLE "sonora"."feedback" ADD CONSTRAINT "feedback_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "sonora"."trips"("id") ON DELETE no action ON UPDATE no action;