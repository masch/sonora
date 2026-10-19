CREATE TYPE "sonora"."map_scope" AS ENUM('global', 'experience');--> statement-breakpoint
CREATE TABLE "sonora"."map_document_bindings" (
	"document_id" uuid NOT NULL,
	"experience_id" uuid NOT NULL,
	CONSTRAINT "map_document_bindings_document_id_experience_id_pk" PRIMARY KEY("document_id","experience_id")
);
--> statement-breakpoint
CREATE TABLE "sonora"."map_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"scope" "sonora"."map_scope" NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"collection" jsonb NOT NULL,
	"bbox_west" double precision NOT NULL,
	"bbox_south" double precision NOT NULL,
	"bbox_east" double precision NOT NULL,
	"bbox_north" double precision NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "map_documents_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "sonora"."map_document_bindings" ADD CONSTRAINT "map_document_bindings_document_id_map_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "sonora"."map_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sonora"."map_document_bindings" ADD CONSTRAINT "map_document_bindings_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "sonora"."experiences"("id") ON DELETE cascade ON UPDATE no action;