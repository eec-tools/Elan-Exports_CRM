-- AlterTable
ALTER TABLE "sourcing_suppliers" ADD COLUMN     "form_template_id" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "warehouse_photos" DROP NOT NULL,
ALTER COLUMN "video_links" DROP NOT NULL;
