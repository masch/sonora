CREATE TABLE "sonora"."experience_coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"experience_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"platform" "sonora"."platform" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experience_coupon_redemptions_coupon_id_device_id_unique" UNIQUE("coupon_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "sonora"."experience_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"email_hash" text NOT NULL,
	"email_masked" text NOT NULL,
	"notes" text NOT NULL,
	"max_downloads" integer DEFAULT 1 NOT NULL,
	"used_downloads" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experience_coupons_experience_id_email_hash_unique" UNIQUE("experience_id","email_hash")
);
--> statement-breakpoint
ALTER TABLE "sonora"."experience_coupon_redemptions" ADD CONSTRAINT "experience_coupon_redemptions_coupon_id_experience_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "sonora"."experience_coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonora"."experience_coupon_redemptions" ADD CONSTRAINT "experience_coupon_redemptions_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonora"."experience_coupons" ADD CONSTRAINT "experience_coupons_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;