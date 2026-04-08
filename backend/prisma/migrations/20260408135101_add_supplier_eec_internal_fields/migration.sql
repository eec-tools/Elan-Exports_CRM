-- AlterTable
ALTER TABLE "attendances" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "new_suppliers" ADD COLUMN     "blacklisted_buyer_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "eec_margin_percent" TEXT,
ADD COLUMN     "exclusivity_arrangement" TEXT,
ADD COLUMN     "factory_visit_date" TEXT,
ADD COLUMN     "factory_visit_outcome" TEXT,
ADD COLUMN     "factory_visit_status" TEXT,
ADD COLUMN     "referral_source" TEXT,
ADD COLUMN     "vetting_score" INTEGER;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "blacklisted_buyer_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "eec_margin_percent" TEXT,
ADD COLUMN     "exclusivity_arrangement" TEXT,
ADD COLUMN     "factory_visit_date" TEXT,
ADD COLUMN     "factory_visit_outcome" TEXT,
ADD COLUMN     "factory_visit_status" TEXT,
ADD COLUMN     "referral_source" TEXT,
ADD COLUMN     "vetting_score" INTEGER;
