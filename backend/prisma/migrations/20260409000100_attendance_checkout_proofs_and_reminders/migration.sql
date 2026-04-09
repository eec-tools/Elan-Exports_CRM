ALTER TABLE "attendances"
ADD COLUMN "checkout_proofs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "checkout_reminder_sent_at" TIMESTAMP(3);
