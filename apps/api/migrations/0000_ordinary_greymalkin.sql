CREATE SCHEMA "sonora";
--> statement-breakpoint
CREATE TYPE "sonora"."experience_format" AS ENUM('track', 'trip');--> statement-breakpoint
CREATE TABLE "sonora"."experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"format" "sonora"."experience_format" NOT NULL,
	"theme_key" text NOT NULL,
	"audio_url" text,
	"duration_seconds" integer NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"recorded_at" timestamp with time zone,
	"price_label" text,
	"image_key" text NOT NULL,
	"is_downloadable" boolean DEFAULT true NOT NULL,
	CONSTRAINT "experiences_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sonora"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"message" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "sonora"."themes" (
	"key" text PRIMARY KEY NOT NULL,
	"label_key" text NOT NULL,
	"order" integer NOT NULL,
	"applicable_format" "sonora"."experience_format"
);
--> statement-breakpoint
CREATE TABLE "sonora"."waypoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"audio_url" text,
	"radius_meters" integer DEFAULT 50 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ADD CONSTRAINT "experiences_theme_key_themes_key_fk" FOREIGN KEY ("theme_key") REFERENCES "sonora"."themes"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonora"."feedback" ADD CONSTRAINT "feedback_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonora"."waypoints" ADD CONSTRAINT "waypoints_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;