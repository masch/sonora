--> statement-breakpoint
ALTER TABLE "sonora"."feedback" RENAME TO "sonora"."feedbacks";
--> statement-breakpoint
ALTER TABLE "sonora"."feedbacks" RENAME CONSTRAINT "feedback_idempotency_key_unique" TO "feedbacks_idempotency_key_unique";
--> statement-breakpoint
ALTER TABLE "sonora"."feedbacks" RENAME CONSTRAINT "feedback_experience_id_experiences_id_fk" TO "feedbacks_experience_id_experiences_id_fk";
