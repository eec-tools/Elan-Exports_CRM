-- Reconcile drift between migration history and actual database state.
-- These changes were previously applied via db push and are already in the DB.

-- AddColumn: users.assigned_companies
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_companies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterEnum: add new Permission variants
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'vault'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'task_tracker'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'email_tracker'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'deals'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'new_suppliers'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'signed_suppliers'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'old_suppliers'; EXCEPTION WHEN others THEN NULL; END $$;

-- DropTable: user_activities (dropped from DB, remove from migration history)
DROP TABLE IF EXISTS "user_activities";

-- AlterTable: attendances.updated_at default
ALTER TABLE "attendances" ALTER COLUMN "updated_at" SET DEFAULT NOW();
