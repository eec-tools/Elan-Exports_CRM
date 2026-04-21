-- AlterTable
ALTER TABLE "sourcing_email_campaigns" ADD COLUMN     "followup3_sent_at" TIMESTAMP(3),
ADD COLUMN     "gmail_message_id" TEXT,
ADD COLUMN     "gmail_thread_id" TEXT,
ADD COLUMN     "last_checked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sourcing_suppliers" ADD COLUMN     "assigned_gmail_account" TEXT;
