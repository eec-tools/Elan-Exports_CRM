-- Fix drift: drop the DEFAULT 0 from scheduled_working_days to match actual DB state
ALTER TABLE "payrolls" ALTER COLUMN "scheduled_working_days" DROP DEFAULT;
