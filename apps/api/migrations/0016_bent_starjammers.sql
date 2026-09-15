CREATE TABLE "sonora"."terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"platform" "sonora"."platform" NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sonora"."terms_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "terms_versions_version_unique" UNIQUE("version")
);
