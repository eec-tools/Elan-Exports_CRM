-- Add contract start/end dates to suppliers
ALTER TABLE "suppliers" ADD COLUMN "contract_start_date" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN "contract_end_date" TIMESTAMP(3);

-- Add buyer_factory_ids JSON field (replaces lidl_factory_id display)
ALTER TABLE "suppliers" ADD COLUMN "buyer_factory_ids" JSONB NOT NULL DEFAULT '[]';

-- Seed buyer_factory_ids from existing lidl_factory_id values
UPDATE "suppliers"
SET "buyer_factory_ids" = jsonb_build_array(
  jsonb_build_object('buyerName', 'Lidl', 'factoryId', "lidl_factory_id")
)
WHERE "lidl_factory_id" IS NOT NULL AND "lidl_factory_id" <> '';
