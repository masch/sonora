-- Step 1: Populate existing NULL device_ids with fallback SHA-256 digest of 'legacy-unknown-device'
-- Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 (SHA-256 of 'legacy-unknown-device')
UPDATE "sonora"."purchases"
SET "device_id" = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
WHERE "device_id" IS NULL;--> statement-breakpoint

UPDATE "sonora"."experience_accesses"
SET "device_id" = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
WHERE "device_id" IS NULL;--> statement-breakpoint

-- Step 2: Enforce NOT NULL constraint
ALTER TABLE "sonora"."experience_accesses" ALTER COLUMN "device_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sonora"."purchases" ALTER COLUMN "device_id" SET NOT NULL;