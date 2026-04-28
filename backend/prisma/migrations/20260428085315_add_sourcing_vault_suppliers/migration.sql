-- CreateTable
CREATE TABLE "sourcing_vault_suppliers" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "contact_person" TEXT,
    "country" TEXT,
    "product" TEXT,
    "notes" TEXT,
    "email_status" TEXT NOT NULL DEFAULT 'Not Sent',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_vault_suppliers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sourcing_vault_suppliers" ADD CONSTRAINT "sourcing_vault_suppliers_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "sourcing_vault_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_vault_suppliers" ADD CONSTRAINT "sourcing_vault_suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
