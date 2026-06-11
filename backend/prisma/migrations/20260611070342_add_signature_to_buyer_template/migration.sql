-- AlterTable
ALTER TABLE "buyer_email_campaign_templates" ADD COLUMN     "signature_id" TEXT;

-- AddForeignKey
ALTER TABLE "buyer_email_campaign_templates" ADD CONSTRAINT "buyer_email_campaign_templates_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "email_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
