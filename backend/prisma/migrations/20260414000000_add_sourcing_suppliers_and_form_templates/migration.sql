-- CreateTable: sourcing_suppliers
CREATE TABLE "sourcing_suppliers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "product_category" TEXT,
    "product" TEXT,
    "country" TEXT,
    "account_manager" TEXT,
    "current_status" TEXT,
    "certifications" TEXT,
    "latest_quotation" TEXT,
    "reason_inactive" TEXT,
    "date_marked_inactive" TEXT,
    "reactivation_potential" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "supplier_stage" TEXT NOT NULL DEFAULT 'Sourcing',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "form_token" TEXT,
    "trade_name" TEXT,
    "year_established" TEXT,
    "manufacturing_address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "supplier_type" TEXT,
    "whatsapp" TEXT,
    "contact_person" TEXT,
    "hs_code" TEXT,
    "organic_status" TEXT,
    "ingredient_list" TEXT,
    "allergen_declaration" TEXT,
    "shelf_life" TEXT,
    "storage_conditions" TEXT,
    "packaging_type" TEXT,
    "net_weight_variants" TEXT,
    "sample_available" TEXT,
    "sample_lead_time" TEXT,
    "sample_cost" TEXT,
    "annual_production_volume" TEXT,
    "avg_monthly_volume" TEXT,
    "max_scalable_monthly_volume" TEXT,
    "peak_season_months" TEXT,
    "off_season_availability" TEXT,
    "min_exportable_batch" TEXT,
    "moq" TEXT,
    "lead_time_first_order" TEXT,
    "lead_time_repeat_order" TEXT,
    "incoterms_supported" TEXT,
    "ports_of_export" TEXT,
    "target_export_markets" TEXT,
    "currency_preferred" TEXT,
    "payment_terms" TEXT,
    "iec_number" TEXT,
    "gst_number" TEXT,
    "fssai_license" TEXT,
    "apeda_number" TEXT,
    "fda_registration_number" TEXT,
    "us_agent_appointed" TEXT,
    "traces_nt_registration" TEXT,
    "coi_capability" TEXT,
    "daff_biosecurity" TEXT,
    "jas_label_compliance" TEXT,
    "haccp_available" TEXT,
    "iso_fssc_cert_no" TEXT,
    "iso_cert_validity_date" TEXT,
    "latest_internal_audit_date" TEXT,
    "latest_third_party_audit_date" TEXT,
    "auditing_body_name" TEXT,
    "farmer_organic_cert" TEXT,
    "aggregator_organic_cert" TEXT,
    "processing_unit_organic_cert" TEXT,
    "certifying_body_name" TEXT,
    "certs_valid_for_export" TEXT,
    "organic_certs_by_market" JSONB,
    "lab_testing_records" JSONB,
    "gmo_free_declaration" TEXT,
    "irradiation_free_declaration" TEXT,
    "food_contact_compliance" TEXT,
    "compostability_cert" TEXT,
    "migration_test_report" TEXT,
    "export_brand" TEXT,
    "health_nutrition_claims" TEXT,
    "claims_approved_markets" TEXT,
    "packaging_compliance_regions" TEXT,
    "organic_segregation_sop" TEXT,
    "cleaning_linelearance_sop" TEXT,
    "no_prohibited_aids" TEXT,
    "product_catalog" TEXT,
    "supplier_products" JSONB DEFAULT '[]',
    "product_catalogs" JSONB DEFAULT '[]',
    "product_catalog_images" JSONB DEFAULT '[]',
    "certificates" JSONB DEFAULT '[]',
    "warehouse_photos" JSONB DEFAULT '[]',
    "video_links" JSONB DEFAULT '[]',
    "quotations" JSONB DEFAULT '[]',
    "buyer_ids" JSONB NOT NULL DEFAULT '[]',
    "deal_stage" TEXT NOT NULL DEFAULT 'Communication',
    "vetting_score" INTEGER,
    "exclusivity_arrangement" TEXT,
    "eec_margin_percent" TEXT,
    "factory_visit_status" TEXT,
    "factory_visit_date" TEXT,
    "factory_visit_outcome" TEXT,
    "referral_source" TEXT,

    CONSTRAINT "sourcing_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sourcing_email_campaigns
CREATE TABLE "sourcing_email_campaigns" (
    "id" TEXT NOT NULL,
    "sourcing_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "intro_email_sent_at" TIMESTAMP(3) NOT NULL,
    "followup1_sent_at" TIMESTAMP(3),
    "followup2_sent_at" TIMESTAMP(3),
    "response_received_at" TIMESTAMP(3),
    "next_followup_due" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: supplier_form_templates
CREATE TABLE "supplier_form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_form_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add contact_person and form_token to new_suppliers
ALTER TABLE "new_suppliers" ADD COLUMN IF NOT EXISTS "contact_person" TEXT;
ALTER TABLE "new_suppliers" ADD COLUMN IF NOT EXISTS "form_token" TEXT;

-- CreateIndex: unique form_token on new_suppliers
CREATE UNIQUE INDEX IF NOT EXISTS "new_suppliers_form_token_key" ON "new_suppliers"("form_token");

-- CreateIndex: unique form_token on sourcing_suppliers
CREATE UNIQUE INDEX IF NOT EXISTS "sourcing_suppliers_form_token_key" ON "sourcing_suppliers"("form_token");

-- CreateIndex: unique sourcing_id on sourcing_email_campaigns
CREATE UNIQUE INDEX IF NOT EXISTS "sourcing_email_campaigns_sourcing_id_key" ON "sourcing_email_campaigns"("sourcing_id");

-- AddForeignKey: sourcing_email_campaigns -> sourcing_suppliers
ALTER TABLE "sourcing_email_campaigns" ADD CONSTRAINT "sourcing_email_campaigns_sourcing_id_fkey"
    FOREIGN KEY ("sourcing_id") REFERENCES "sourcing_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
