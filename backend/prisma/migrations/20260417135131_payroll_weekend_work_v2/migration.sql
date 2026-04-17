/*
  Warnings:

  - You are about to drop the column `absent_days` on the `payrolls` table. All the data in the column will be lost.
  - You are about to drop the column `approved_leaves` on the `payrolls` table. All the data in the column will be lost.
  - You are about to drop the column `present_days` on the `payrolls` table. All the data in the column will be lost.
  - You are about to drop the column `working_days` on the `payrolls` table. All the data in the column will be lost.
  - Added the required column `approved_leaves_month` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `days_in_month` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `excess_leave_days` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leave_salary_deduction` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paid_days` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `per_day_salary` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekday_present_days` to the `payrolls` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekend_worked_days` to the `payrolls` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "is_weekend_work" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payrolls" DROP COLUMN "absent_days",
DROP COLUMN "approved_leaves",
DROP COLUMN "present_days",
DROP COLUMN "working_days",
ADD COLUMN     "approved_leaves_month" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "days_in_month" INTEGER NOT NULL,
ADD COLUMN     "excess_leave_days" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "leave_salary_deduction" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "paid_days" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "per_day_salary" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "weekday_present_days" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "weekend_worked_days" DOUBLE PRECISION NOT NULL;
