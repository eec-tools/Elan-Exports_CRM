-- AlterTable
ALTER TABLE "new_supplier_email_campaigns" ADD COLUMN     "gmail_message_id" TEXT,
ADD COLUMN     "gmail_thread_id" TEXT,
ADD COLUMN     "last_checked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "new_suppliers" ADD COLUMN     "assigned_gmail_account" TEXT;

-- AlterTable
ALTER TABLE "supplier_email_campaigns" ADD COLUMN     "gmail_message_id" TEXT,
ADD COLUMN     "gmail_thread_id" TEXT,
ADD COLUMN     "last_checked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "supplier_email_replies" ADD COLUMN     "contract_supplier_id" TEXT,
ADD COLUMN     "new_supplier_id" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "assigned_gmail_account" TEXT;

-- AddForeignKey
-- NOTE: intentionally NOT re-adding supplier_email_replies_sourcing_id_fkey here.
-- It does not currently exist in production (stripped in migration
-- 20260722113048_add_email_attachments after failing against orphaned
-- sourcing_id rows — see that incident). Re-adding it would fail the same way.
ALTER TABLE "supplier_email_replies" ADD CONSTRAINT "supplier_email_replies_new_supplier_id_fkey" FOREIGN KEY ("new_supplier_id") REFERENCES "new_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_email_replies" ADD CONSTRAINT "supplier_email_replies_contract_supplier_id_fkey" FOREIGN KEY ("contract_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
