-- AddForeignKey
ALTER TABLE "sourcing_suppliers" ADD CONSTRAINT "sourcing_suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
