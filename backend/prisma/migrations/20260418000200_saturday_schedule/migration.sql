-- AlterTable: replace saturday_off + sunday_off with saturday_schedule
ALTER TABLE "users" DROP COLUMN IF EXISTS "sunday_off";
ALTER TABLE "users" DROP COLUMN IF EXISTS "saturday_off";
ALTER TABLE "users" ADD COLUMN "saturday_schedule" TEXT NOT NULL DEFAULT 'off';
