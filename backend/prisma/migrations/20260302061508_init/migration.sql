-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('buyers', 'suppliers', 'analytics', 'reports');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('read', 'edit');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
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
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "product_category" TEXT,
    "country" TEXT,
    "contact_person" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "products" TEXT,
    "contract_buyer" TEXT,
    "commission_percent" TEXT,
    "certifications" TEXT,
    "production_capacity" TEXT,
    "contract_start_date" DATE,
    "contract_end_date" DATE,
    "contract_value" TEXT,
    "renewal_date" DATE,
    "current_status" TEXT DEFAULT 'Active',
    "performance_score" TEXT,
    "remarks" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_key" ON "user_permissions"("user_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
