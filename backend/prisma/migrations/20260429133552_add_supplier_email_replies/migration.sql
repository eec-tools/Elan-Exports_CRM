-- AlterTable
ALTER TABLE "new_suppliers" ADD COLUMN     "converted_from_sourcing_id" TEXT;

-- CreateTable
CREATE TABLE "supplier_email_replies" (
    "id" TEXT NOT NULL,
    "sourcing_id" TEXT,
    "gmail_message_id" TEXT,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_email_replies_pkey" PRIMARY KEY ("id")
);
