-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('buyers', 'suppliers', 'analytics', 'reports', 'vault', 'task_tracker');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('read', 'edit');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('RECEIVED', 'PENDING', 'MISSING');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('Present', 'Absent');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "work_start_time" TEXT NOT NULL DEFAULT '09:00',
    "work_end_time" TEXT NOT NULL DEFAULT '18:00',
    "min_hours_present" INTEGER NOT NULL DEFAULT 420,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'edit',

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT NOT NULL,
    "address" TEXT,
    "website" TEXT,
    "region" TEXT,
    "product_category_interest" TEXT,
    "moq_requirements" TEXT,
    "pricing_range" TEXT,
    "certification_requirements" TEXT,
    "payment_terms" TEXT,
    "incoterms" TEXT,
    "risk_rating" TEXT,
    "strategic_value" TEXT,
    "lead_source" TEXT,
    "last_contact_date" DATE,
    "deal_history" TEXT,
    "notes" TEXT,
    "status" TEXT DEFAULT 'Pending',
    "required_products" JSONB NOT NULL DEFAULT '[]',
    "trade_name" TEXT,
    "buyer_type" TEXT,
    "city" TEXT,
    "whatsapp" TEXT,
    "contact_role" TEXT,
    "additional_contacts" JSONB,
    "product_categories" TEXT,
    "markets_served" TEXT,
    "annual_import_volume" TEXT,
    "annual_purchase_value" TEXT,
    "current_suppliers_origins" TEXT,
    "sourcing_requirements" JSONB,
    "preferred_currency" TEXT,
    "shipping_mode" TEXT,
    "ports_of_discharge" TEXT,
    "country_of_final_delivery" TEXT,
    "freight_forwarder" TEXT,
    "packing_requirements" TEXT,
    "social_ethical_compliance" TEXT,
    "how_heard_about_us" TEXT,
    "trade_fair_name" TEXT,
    "product_catalog_shared" TEXT,
    "supplier_links" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "country" TEXT,
    "contact_person" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "products" TEXT,
    "contract_buyer" TEXT,
    "commission_percent" TEXT,
    "certifications" TEXT,
    "production_capacity" TEXT,
    "current_status" TEXT DEFAULT 'Under Review',
    "remarks" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_confirm_percent" TEXT,
    "company_address" TEXT,
    "exporting_countries" TEXT,
    "factory_videos_shared" TEXT,
    "lidl_factory_id" TEXT,
    "other_brands" TEXT,
    "product_catalog_shared" TEXT,
    "sample_policy" TEXT,
    "warehouse_videos_shared" TEXT,
    "website" TEXT,
    "working_with_our_brands" TEXT,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "contract_document" JSONB,
    "supplier_stage" TEXT NOT NULL DEFAULT 'Signed',
    "trade_name" TEXT,
    "year_established" TEXT,
    "manufacturing_address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "supplier_type" TEXT,
    "whatsapp" TEXT,
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
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "bank_address" TEXT,
    "account_number" TEXT,
    "swift_bic_code" TEXT,
    "iban" TEXT,
    "lc_advising_bank_name" TEXT,
    "lc_beneficiary_name" TEXT,
    "lc_bank_address" TEXT,
    "lc_swift_code" TEXT,
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
    "supplier_products" JSONB DEFAULT '[]',
    "product_catalogs" JSONB DEFAULT '[]',
    "product_catalog_images" JSONB DEFAULT '[]',
    "buyer_ids" JSONB NOT NULL DEFAULT '[]',
    "deal_stage" TEXT NOT NULL DEFAULT 'Communication',

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_email_campaigns" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "intro_email_sent_at" TIMESTAMP(3) NOT NULL,
    "followup1_sent_at" TIMESTAMP(3),
    "followup2_sent_at" TIMESTAMP(3),
    "followup3_sent_at" TIMESTAMP(3),
    "response_received_at" TIMESTAMP(3),
    "next_followup_due" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "old_suppliers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "country" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "account_manager" TEXT,
    "certifications" TEXT,
    "current_status" TEXT,
    "date_marked_inactive" TEXT,
    "latest_quotation" TEXT,
    "product" TEXT,
    "product_category" TEXT,
    "reactivation_potential" TEXT,
    "reason_inactive" TEXT,
    "supplier_stage" TEXT NOT NULL DEFAULT 'Closed',
    "deal_stage" TEXT NOT NULL DEFAULT 'Communication',

    CONSTRAINT "old_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "new_suppliers" (
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
    "supplier_stage" TEXT NOT NULL DEFAULT 'Onboarding',
    "trade_name" TEXT,
    "year_established" TEXT,
    "manufacturing_address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "supplier_type" TEXT,
    "whatsapp" TEXT,
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
    "buyer_ids" JSONB NOT NULL DEFAULT '[]',
    "deal_stage" TEXT NOT NULL DEFAULT 'Communication',

    CONSTRAINT "new_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "new_supplier_email_campaigns" (
    "id" TEXT NOT NULL,
    "new_supplier_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "intro_email_sent_at" TIMESTAMP(3) NOT NULL,
    "followup1_sent_at" TIMESTAMP(3),
    "followup2_sent_at" TIMESTAMP(3),
    "followup3_sent_at" TIMESTAMP(3),
    "response_received_at" TIMESTAMP(3),
    "next_followup_due" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "new_supplier_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_image_url" TEXT,
    "buyer_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "key_updates" TEXT,
    "update_date" DATE,
    "buyer_supplier" TEXT NOT NULL DEFAULT 'Buyer',
    "report_date" DATE NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deal_stage" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "total_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "idle_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "real_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'Absent',
    "late_login" BOOLEAN NOT NULL DEFAULT false,
    "early_logout" BOOLEAN NOT NULL DEFAULT false,
    "auto_ended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_heartbeats" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_active_ms" BIGINT NOT NULL DEFAULT 0,
    "total_idle_ms" BIGINT NOT NULL DEFAULT 0,
    "mouse_clicks" INTEGER NOT NULL DEFAULT 0,
    "keystrokes" INTEGER NOT NULL DEFAULT 0,
    "page_views" INTEGER NOT NULL DEFAULT 0,
    "pages_visited" JSONB NOT NULL DEFAULT '[]',
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tracker" (
    "id" TEXT NOT NULL,
    "date_received" TIMESTAMP(3) NOT NULL,
    "sender_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "task" TEXT,
    "product_category" TEXT,
    "priority" TEXT,
    "respondent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "notes" TEXT,
    "email_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Global',
    "file_url" TEXT,
    "public_id" TEXT,
    "file_type" TEXT,
    "is_folder" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "task_text" TEXT NOT NULL,
    "company" TEXT,
    "priority" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "deadline" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "buyer" TEXT,
    "supplier" TEXT,
    "product" TEXT,
    "hs_code" TEXT,
    "volume" TEXT,
    "price" DOUBLE PRECISION,
    "expected_revenue" DOUBLE PRECISION,
    "margin" DOUBLE PRECISION DEFAULT 15,
    "stage" TEXT NOT NULL DEFAULT 'Communication',
    "probability" DOUBLE PRECISION DEFAULT 20,
    "category" TEXT,
    "risk_score" TEXT DEFAULT 'Medium',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_documents" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'MISSING',
    "due_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_link" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_key" ON "user_permissions"("user_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_email_campaigns_supplier_id_key" ON "supplier_email_campaigns"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "new_supplier_email_campaigns_new_supplier_id_key" ON "new_supplier_email_campaigns"("new_supplier_id");

-- CreateIndex
CREATE INDEX "attendances_date_idx" ON "attendances"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_user_id_date_key" ON "attendances"("user_id", "date");

-- CreateIndex
CREATE INDEX "attendance_heartbeats_attendance_id_timestamp_idx" ON "attendance_heartbeats"("attendance_id", "timestamp");

-- CreateIndex
CREATE INDEX "attendance_heartbeats_user_id_timestamp_idx" ON "attendance_heartbeats"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "user_activities_date_idx" ON "user_activities"("date");

-- CreateIndex
CREATE UNIQUE INDEX "user_activities_user_id_date_key" ON "user_activities"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_notification_id_user_id_key" ON "notification_reads"("notification_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_email_campaigns" ADD CONSTRAINT "supplier_email_campaigns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "new_supplier_email_campaigns" ADD CONSTRAINT "new_supplier_email_campaigns_new_supplier_id_fkey" FOREIGN KEY ("new_supplier_id") REFERENCES "new_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_heartbeats" ADD CONSTRAINT "attendance_heartbeats_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_heartbeats" ADD CONSTRAINT "attendance_heartbeats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "vault_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

