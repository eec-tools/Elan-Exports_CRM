-- AlterTable
ALTER TABLE "buyers" ADD COLUMN IF NOT EXISTS "quotations" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "quotations" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "new_suppliers" ADD COLUMN IF NOT EXISTS "quotations" JSONB DEFAULT '[]';
