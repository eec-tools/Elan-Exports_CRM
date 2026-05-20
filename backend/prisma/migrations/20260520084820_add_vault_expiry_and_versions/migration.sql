-- AlterTable
ALTER TABLE "vault_documents" ADD COLUMN     "expiry_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "vault_document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_num" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "public_id" TEXT,
    "file_type" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_document_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vault_document_versions" ADD CONSTRAINT "vault_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "vault_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_document_versions" ADD CONSTRAINT "vault_document_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
