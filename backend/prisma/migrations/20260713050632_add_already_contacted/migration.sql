-- AlterTable
ALTER TABLE "sourcing_buyers" ADD COLUMN     "already_contacted" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "buyer_email_replies" ADD CONSTRAINT "buyer_email_replies_sourcing_buyer_id_fkey" FOREIGN KEY ("sourcing_buyer_id") REFERENCES "sourcing_buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
