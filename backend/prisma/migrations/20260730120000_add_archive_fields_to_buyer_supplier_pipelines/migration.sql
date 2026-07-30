-- AlterTable
ALTER TABLE "buyers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "buyers" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "buyers" ADD COLUMN "archived_by" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "suppliers" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN "archived_by" TEXT;

-- AlterTable
ALTER TABLE "old_suppliers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "old_suppliers" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "old_suppliers" ADD COLUMN "archived_by" TEXT;

-- AlterTable
ALTER TABLE "new_suppliers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "new_suppliers" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "new_suppliers" ADD COLUMN "archived_by" TEXT;

-- AlterTable
ALTER TABLE "sourcing_suppliers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sourcing_suppliers" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "sourcing_suppliers" ADD COLUMN "archived_by" TEXT;

-- AlterTable
ALTER TABLE "sourcing_buyers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sourcing_buyers" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "sourcing_buyers" ADD COLUMN "archived_by" TEXT;

-- CreateIndex
CREATE INDEX "buyers_is_archived_idx" ON "buyers"("is_archived");

-- CreateIndex
CREATE INDEX "suppliers_is_archived_idx" ON "suppliers"("is_archived");

-- CreateIndex
CREATE INDEX "old_suppliers_is_archived_idx" ON "old_suppliers"("is_archived");

-- CreateIndex
CREATE INDEX "new_suppliers_is_archived_idx" ON "new_suppliers"("is_archived");

-- CreateIndex
CREATE INDEX "sourcing_suppliers_is_archived_idx" ON "sourcing_suppliers"("is_archived");

-- CreateIndex
CREATE INDEX "sourcing_buyers_is_archived_idx" ON "sourcing_buyers"("is_archived");
