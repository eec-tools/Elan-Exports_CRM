-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "warehouse_photos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "video_links" JSONB NOT NULL DEFAULT '[]';
