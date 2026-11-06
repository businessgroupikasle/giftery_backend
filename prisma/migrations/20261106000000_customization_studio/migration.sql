-- Customization studio: multiple saved designs per product, richer private assets,
-- per-product options and an admin review status on ordered items.
-- Existing drafts, cart lines and order items are preserved and backfilled.

CREATE TYPE "CustomizationDesignStatus" AS ENUM ('DRAFT', 'SAVED', 'ORDERED');
CREATE TYPE "CustomizationReviewStatus" AS ENUM ('PENDING_REVIEW', 'DESIGN_APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

ALTER TABLE "products" ADD COLUMN "customizationConfig" JSONB;

ALTER TABLE "customization_assets"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LOGO',
  ADD COLUMN "originalName" TEXT,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "sourceStorageKey" TEXT;
CREATE UNIQUE INDEX "customization_assets_sourceStorageKey_key" ON "customization_assets"("sourceStorageKey");

-- A customer can now keep several designs for one product.
DROP INDEX "customization_drafts_userId_productId_key";
ALTER TABLE "customization_drafts"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT 'My design',
  ADD COLUMN "variantId" TEXT,
  ADD COLUMN "options" JSONB,
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "instructions" JSONB,
  ADD COLUMN "assetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "previewAssetId" TEXT,
  ADD COLUMN "previewInfo" JSONB,
  ADD COLUMN "status" "CustomizationDesignStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "customization_drafts_userId_productId_idx" ON "customization_drafts"("userId", "productId");
CREATE INDEX "customization_drafts_userId_updatedAt_idx" ON "customization_drafts"("userId", "updatedAt");

UPDATE "customization_drafts" SET
  "createdAt" = "updatedAt",
  "previewAssetId" = "design"->>'previewAssetId',
  "assetIds" = ARRAY(
    SELECT value FROM (VALUES ("design"->>'imageAssetId'), ("design"->>'previewAssetId')) AS ids(value)
    WHERE value IS NOT NULL
  ),
  "status" = CASE WHEN "design"->>'previewAssetId' IS NULL THEN 'DRAFT'::"CustomizationDesignStatus" ELSE 'SAVED'::"CustomizationDesignStatus" END;

ALTER TABLE "cart_items" ADD COLUMN "customizationId" TEXT;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customizationId_fkey"
  FOREIGN KEY ("customizationId") REFERENCES "customization_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "cart_items_customizationId_idx" ON "cart_items"("customizationId");

-- Link existing customized cart lines to the design they were saved from.
UPDATE "cart_items" AS line SET "customizationId" = draft."id"
FROM "carts" AS cart, "customization_drafts" AS draft
WHERE line."cartId" = cart."id" AND line."customization" IS NOT NULL
  AND draft."userId" = cart."userId" AND draft."productId" = line."productId"
  AND draft."design" = line."customization";

ALTER TABLE "order_items"
  ADD COLUMN "customizationId" TEXT,
  ADD COLUMN "customizationCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "customizationStatus" "CustomizationReviewStatus",
  ADD COLUMN "customizationStatusNote" TEXT,
  ADD COLUMN "customizationStatusAt" TIMESTAMP(3);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_customizationId_fkey"
  FOREIGN KEY ("customizationId") REFERENCES "customization_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "order_items_customizationStatus_idx" ON "order_items"("customizationStatus");

UPDATE "order_items" SET "customizationStatus" = 'PENDING_REVIEW', "customizationStatusAt" = CURRENT_TIMESTAMP
WHERE "customization" IS NOT NULL;
