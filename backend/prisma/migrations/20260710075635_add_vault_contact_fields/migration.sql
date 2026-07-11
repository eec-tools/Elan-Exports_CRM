-- AlterTable
ALTER TABLE "buyer_vault_contacts" ADD COLUMN     "email_template" TEXT,
ADD COLUMN     "key_pain_points" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "personalization_quality" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "sourcing_buyers" ADD COLUMN     "custom_email_body" TEXT;
