-- AlterTable: add scheduled_working_days and saturday_schedule snapshot to payrolls
ALTER TABLE "payrolls" ADD COLUMN "scheduled_working_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payrolls" ADD COLUMN "saturday_schedule" TEXT NOT NULL DEFAULT 'off';
