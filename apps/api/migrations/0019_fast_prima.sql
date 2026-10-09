ALTER TABLE "sonora"."experience_coupons" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
UPDATE "sonora"."experience_coupons" SET "starts_at" = "created_at" WHERE "starts_at" IS NULL;--> statement-breakpoint
ALTER TABLE "sonora"."experience_coupons" ALTER COLUMN "starts_at" SET NOT NULL;