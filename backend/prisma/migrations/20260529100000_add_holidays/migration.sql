-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- AlterTable: add holiday fields to payrolls
ALTER TABLE "payrolls" ADD COLUMN "holiday_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payrolls" ADD COLUMN "holiday_paid_days" DOUBLE PRECISION NOT NULL DEFAULT 0;
