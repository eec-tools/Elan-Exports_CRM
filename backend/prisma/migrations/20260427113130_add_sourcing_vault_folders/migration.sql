-- CreateTable
CREATE TABLE "sourcing_vault_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_vault_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sourcing_vault_folders_name_key" ON "sourcing_vault_folders"("name");

-- AddForeignKey
ALTER TABLE "sourcing_vault_folders" ADD CONSTRAINT "sourcing_vault_folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
