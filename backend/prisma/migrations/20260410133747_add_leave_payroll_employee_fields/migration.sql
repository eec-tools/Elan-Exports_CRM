-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('intern', 'probation', 'confirmed');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'HalfDay';
ALTER TYPE "AttendanceStatus" ADD VALUE 'WeeklyOff';
ALTER TYPE "AttendanceStatus" ADD VALUE 'Leave';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bank_account_number" TEXT,
ADD COLUMN     "bank_ifsc" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "employee_status" "EmployeeStatus" NOT NULL DEFAULT 'probation',
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "monthly_salary" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "number_of_days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "working_days" INTEGER NOT NULL,
    "present_days" DOUBLE PRECISION NOT NULL,
    "approved_leaves" DOUBLE PRECISION NOT NULL,
    "absent_days" DOUBLE PRECISION NOT NULL,
    "gross_salary" DOUBLE PRECISION NOT NULL,
    "professional_tax" DOUBLE PRECISION NOT NULL,
    "net_salary" DOUBLE PRECISION NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL,
    "saturday_off" BOOLEAN NOT NULL DEFAULT true,
    "sunday_off" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leaves_user_id_idx" ON "leaves"("user_id");

-- CreateIndex
CREATE INDEX "leaves_start_date_end_date_idx" ON "leaves"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_user_id_month_year_key" ON "payrolls"("user_id", "month", "year");

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
