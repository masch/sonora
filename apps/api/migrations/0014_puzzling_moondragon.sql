CREATE TYPE "sonora"."geo_mode" AS ENUM('any', 'type', 'entity');--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ADD COLUMN "geo_mode" "sonora"."geo_mode" DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ADD COLUMN "radius_meters" integer;--> statement-breakpoint
UPDATE "sonora"."experiences" SET "geo_mode" = 'type' WHERE "format" = 'trip';--> statement-breakpoint
UPDATE "sonora"."experiences" SET "geo_mode" = 'any' WHERE "format" = 'track';--> statement-breakpoint
ALTER TABLE "sonora"."experiences" ALTER COLUMN "geo_mode" DROP DEFAULT;