-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PriorityTier" AS ENUM ('High', 'Medium', 'Low');

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "product_category" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'pending',
    "total_found" INTEGER NOT NULL DEFAULT 0,
    "total_scored" INTEGER NOT NULL DEFAULT 0,
    "total_high_prio" INTEGER NOT NULL DEFAULT 0,
    "total_med_prio" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_companies" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT NOT NULL,
    "industry" TEXT,
    "employee_range" TEXT,
    "revenue_range" TEXT,
    "description" TEXT,
    "products_imported" TEXT,
    "asia_connection" BOOLEAN NOT NULL DEFAULT false,
    "india_connection" BOOLEAN NOT NULL DEFAULT false,
    "source_url" TEXT,
    "fit_score" INTEGER,
    "score_dim1" INTEGER,
    "score_dim2" INTEGER,
    "score_dim3" INTEGER,
    "score_dim4" INTEGER,
    "score_dim5" INTEGER,
    "priority_tier" "PriorityTier",
    "rationale" TEXT,
    "discard_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_contacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "email" TEXT NOT NULL,
    "email_status" TEXT NOT NULL,
    "email_confidence" INTEGER,
    "linkedin_url" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "discovered_companies" ADD CONSTRAINT "discovered_companies_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_contacts" ADD CONSTRAINT "agent_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "discovered_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
