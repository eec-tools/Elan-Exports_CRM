-- AlterTable
ALTER TABLE "buyer_email_replies" ADD COLUMN     "replied_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "daily_tasks" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "completed_by" TEXT;

-- AlterTable
ALTER TABLE "supplier_email_replies" ADD COLUMN     "replied_at" TIMESTAMP(3);
