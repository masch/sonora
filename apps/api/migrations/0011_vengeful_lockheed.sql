-- Add platform column to purchases using existing platformEnum
-- Step 1: Add column with temporary DEFAULT to satisfy NOT NULL on existing rows
ALTER TABLE "sonora"."purchases" ADD COLUMN "platform" "sonora"."platform" NOT NULL DEFAULT 'android';
-- Step 2: Remove default — application always provides a value
ALTER TABLE "sonora"."purchases" ALTER COLUMN "platform" DROP DEFAULT;