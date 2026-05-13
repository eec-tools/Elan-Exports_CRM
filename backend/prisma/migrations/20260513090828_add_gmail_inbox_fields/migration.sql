-- AlterTable
ALTER TABLE "email_tracker" ADD COLUMN     "gmail_account" TEXT,
ADD COLUMN     "thread_id" TEXT,
ALTER COLUMN "source" SET DEFAULT 'gmail';

-- CreateIndex
CREATE INDEX "email_tracker_gmail_account_idx" ON "email_tracker"("gmail_account");

-- CreateIndex
CREATE INDEX "email_tracker_thread_id_idx" ON "email_tracker"("thread_id");
