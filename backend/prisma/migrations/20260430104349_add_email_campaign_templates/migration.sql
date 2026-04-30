-- AlterTable
ALTER TABLE "sourcing_suppliers" ADD COLUMN     "email_template_id" TEXT;

-- CreateTable
CREATE TABLE "email_campaign_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "intro_subject" TEXT NOT NULL,
    "intro_body" TEXT NOT NULL,
    "followup1_subject" TEXT NOT NULL,
    "followup1_body" TEXT NOT NULL,
    "followup2_subject" TEXT NOT NULL,
    "followup2_body" TEXT NOT NULL,
    "followup3_subject" TEXT NOT NULL,
    "followup3_body" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_templates_pkey" PRIMARY KEY ("id")
);
