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
