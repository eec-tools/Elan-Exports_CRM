-- AlterTable
ALTER TABLE "sourcing_suppliers" ADD COLUMN "short_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sourcing_suppliers_short_code_key" ON "sourcing_suppliers"("short_code");
