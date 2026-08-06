ALTER TABLE "sonora"."experiences" ADD COLUMN "published" boolean DEFAULT true NOT NULL;
ALTER TABLE "sonora"."experiences" ALTER COLUMN "published" DROP DEFAULT;