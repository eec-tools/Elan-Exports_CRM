-- Add attendance settings to users
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "work_start_time" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS "work_end_time" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS "min_hours_present" INTEGER NOT NULL DEFAULT 420;

-- Create enum only if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
    CREATE TYPE "AttendanceStatus" AS ENUM ('Present', 'Absent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "attendances" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "start_time" TIMESTAMP(3),
  "end_time" TIMESTAMP(3),
  "total_time_minutes" INTEGER NOT NULL DEFAULT 0,
  "idle_time_minutes" INTEGER NOT NULL DEFAULT 0,
  "real_time_minutes" INTEGER NOT NULL DEFAULT 0,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'Absent',
  "late_login" BOOLEAN NOT NULL DEFAULT false,
  "early_logout" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attendance_heartbeats" (
  "id" TEXT NOT NULL,
  "attendance_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_heartbeats_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendances_user_id_fkey'
  ) THEN
    ALTER TABLE "attendances"
    ADD CONSTRAINT "attendances_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_heartbeats_attendance_id_fkey'
  ) THEN
    ALTER TABLE "attendance_heartbeats"
    ADD CONSTRAINT "attendance_heartbeats_attendance_id_fkey"
    FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_heartbeats_user_id_fkey'
  ) THEN
    ALTER TABLE "attendance_heartbeats"
    ADD CONSTRAINT "attendance_heartbeats_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "attendances_user_id_date_key" ON "attendances"("user_id", "date");
CREATE INDEX IF NOT EXISTS "attendances_date_idx" ON "attendances"("date");
CREATE INDEX IF NOT EXISTS "attendance_heartbeats_attendance_id_timestamp_idx" ON "attendance_heartbeats"("attendance_id", "timestamp");
CREATE INDEX IF NOT EXISTS "attendance_heartbeats_user_id_timestamp_idx" ON "attendance_heartbeats"("user_id", "timestamp");
