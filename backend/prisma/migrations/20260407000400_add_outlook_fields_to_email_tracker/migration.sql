-- AlterTable: add Outlook/Graph API sync fields to email_tracker
ALTER TABLE "email_tracker"
  ADD COLUMN IF NOT EXISTS "message_id"      TEXT,
  ADD COLUMN IF NOT EXISTS "conversation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "body_preview"    TEXT,
  ADD COLUMN IF NOT EXISTS "importance"      TEXT,
  ADD COLUMN IF NOT EXISTS "is_read"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "source"          TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "synced_at"       TIMESTAMP(3);

-- CreateIndex: unique constraint on message_id (NULL-safe — NULL values never conflict)
CREATE UNIQUE INDEX IF NOT EXISTS "email_tracker_message_id_key"
  ON "email_tracker"("message_id");

-- CreateIndex: index on conversation_id for thread grouping queries
CREATE INDEX IF NOT EXISTS "email_tracker_conversation_id_idx"
  ON "email_tracker"("conversation_id");
