CREATE TABLE "sonora"."translations" (
	"lang" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translations_lang_key_pk" PRIMARY KEY("lang","key")
);
