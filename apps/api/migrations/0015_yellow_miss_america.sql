CREATE TABLE "sonora"."free_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"email" text NOT NULL,
	"device_id" text NOT NULL,
	"platform" "sonora"."platform",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sonora"."free_downloads" ADD CONSTRAINT "free_downloads_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;