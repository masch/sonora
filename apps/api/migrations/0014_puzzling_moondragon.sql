CREATE TYPE "sonora"."geo_mode" AS ENUM('unrestricted', 'formatDefaultRadius', 'entityRadius');--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ADD COLUMN "geo_mode" "sonora"."geo_mode" DEFAULT 'unrestricted' NOT NULL;--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ADD COLUMN "radius_meters" integer;--> statement-breakpoint
UPDATE "sonora"."experiences" SET "geo_mode" = 'formatDefaultRadius' WHERE "format" = 'trip';--> statement-breakpoint
UPDATE "sonora"."experiences" SET "geo_mode" = 'formatDefaultRadius' WHERE "format" = 'track';--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ALTER COLUMN "geo_mode" DROP DEFAULT;