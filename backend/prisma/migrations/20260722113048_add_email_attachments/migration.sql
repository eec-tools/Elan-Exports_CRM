-- CreateTable
CREATE TABLE "supplier_email_attachments" (
    "id" TEXT NOT NULL,
    "reply_id" TEXT NOT NULL,
    "gmail_attachment_id" TEXT,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER,
    "s3_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_email_attachments" (
    "id" TEXT NOT NULL,
    "reply_id" TEXT NOT NULL,
    "gmail_attachment_id" TEXT,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER,
    "s3_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_email_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "supplier_email_attachments" ADD CONSTRAINT "supplier_email_attachments_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "supplier_email_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_email_attachments" ADD CONSTRAINT "buyer_email_attachments_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "buyer_email_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
