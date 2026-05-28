-- CreateTable
CREATE TABLE "buyer_vault_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_vault_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_vault_contacts" (
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

    CONSTRAINT "buyer_vault_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_vault_folders_name_key" ON "buyer_vault_folders"("name");

-- AddForeignKey
ALTER TABLE "buyer_vault_folders" ADD CONSTRAINT "buyer_vault_folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_vault_contacts" ADD CONSTRAINT "buyer_vault_contacts_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "buyer_vault_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_vault_contacts" ADD CONSTRAINT "buyer_vault_contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
