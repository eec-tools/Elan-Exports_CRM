-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'sourcing_buyers';

-- CreateTable
CREATE TABLE "sourcing_buyers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "contact_person" TEXT,
    "country" TEXT,
    "product" TEXT,
    "product_category" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_gmail_account" TEXT,
    "email_template_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_buyer_email_campaigns" (
    "id" TEXT NOT NULL,
    "sourcing_buyer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "intro_email_sent_at" TIMESTAMP(3) NOT NULL,
    "followup1_sent_at" TIMESTAMP(3),
    "followup2_sent_at" TIMESTAMP(3),
    "followup3_sent_at" TIMESTAMP(3),
    "response_received_at" TIMESTAMP(3),
    "next_followup_due" TIMESTAMP(3),
    "gmail_thread_id" TEXT,
    "gmail_message_id" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_buyer_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_email_replies" (
    "id" TEXT NOT NULL,
    "sourcing_buyer_id" TEXT,
    "gmail_message_id" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'received',
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_email_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sourcing_buyer_email_campaigns_sourcing_buyer_id_key" ON "sourcing_buyer_email_campaigns"("sourcing_buyer_id");

-- AddForeignKey
ALTER TABLE "sourcing_buyers" ADD CONSTRAINT "sourcing_buyers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_buyer_email_campaigns" ADD CONSTRAINT "sourcing_buyer_email_campaigns_sourcing_buyer_id_fkey" FOREIGN KEY ("sourcing_buyer_id") REFERENCES "sourcing_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
