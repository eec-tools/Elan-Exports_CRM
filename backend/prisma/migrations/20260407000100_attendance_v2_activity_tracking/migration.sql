-- Add auto_ended column to attendances
ALTER TABLE "attendances"
ADD COLUMN IF NOT EXISTS "auto_ended" BOOLEAN NOT NULL DEFAULT false;

-- Create activity_events table for tracking user website activity
CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "page" TEXT,
  "details" JSONB,
  "active_seconds" INTEGER NOT NULL DEFAULT 0,
  "idle_seconds" INTEGER NOT NULL DEFAULT 0,
  "click_count" INTEGER NOT NULL DEFAULT 0,
  "key_count" INTEGER NOT NULL DEFAULT 0,
  "scroll_depth" INTEGER NOT NULL DEFAULT 0,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- Add foreign key from activity_events to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_user_id_fkey'
  ) THEN
    ALTER TABLE "activity_events"
    ADD CONSTRAINT "activity_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create indexes for activity_events
CREATE INDEX IF NOT EXISTS "activity_events_user_id_timestamp_idx" ON "activity_events"("user_id", "timestamp");
CREATE INDEX IF NOT EXISTS "activity_events_session_id_idx" ON "activity_events"("session_id");
CREATE INDEX IF NOT EXISTS "activity_events_timestamp_idx" ON "activity_events"("timestamp");
