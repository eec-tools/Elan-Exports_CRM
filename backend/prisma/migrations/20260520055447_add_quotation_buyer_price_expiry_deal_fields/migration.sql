-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "buyer_id" TEXT,
ADD COLUMN     "buyer_name" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "linked_deal_id" TEXT,
ADD COLUMN     "quoted_price" TEXT,
ADD COLUMN     "valid_until" DATE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
