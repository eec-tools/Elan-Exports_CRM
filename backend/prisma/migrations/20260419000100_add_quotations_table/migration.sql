-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "form_token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "linked_supplier_id" TEXT,
    "linked_supplier_type" TEXT,
    "supplier_name" TEXT NOT NULL,
    "supplier_website" TEXT,
    "field_config" JSONB NOT NULL DEFAULT '{}',
    "field_sources" JSONB NOT NULL DEFAULT '{}',
    "date" TEXT,
    "hs_code" TEXT,
    "product" TEXT,
    "fcl_details" TEXT,
    "fob_supplier_price" TEXT,
    "fob_commission_percent" TEXT,
    "fob_with_commission" TEXT,
    "cif_supplier_price" TEXT,
    "cif_with_commission" TEXT,
    "loadability" TEXT,
    "packing" TEXT,
    "payment_terms" TEXT,
    "origin" TEXT,
    "price_validity" TEXT,
    "supplier_certifications" TEXT,
    "lead_time" TEXT,
    "supplier_comments" TEXT,
    "buyer_specifications" JSONB DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_form_token_key" ON "quotations"("form_token");
