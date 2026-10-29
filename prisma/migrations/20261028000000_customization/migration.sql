ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cartId_productId_key";
DROP INDEX IF EXISTS "cart_items_cartId_productId_key";
ALTER TABLE "cart_items" ADD COLUMN "customization" JSONB;
ALTER TABLE "order_items" ADD COLUMN "customization" JSONB;
CREATE INDEX "cart_items_cartId_productId_idx" ON "cart_items"("cartId", "productId");
CREATE UNIQUE INDEX "cart_items_regular_unique" ON "cart_items"("cartId", "productId") WHERE "customization" IS NULL;
CREATE TABLE "customization_assets" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE, "size" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customization_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customization_assets_userId_idx" ON "customization_assets"("userId");
CREATE TABLE "customization_drafts" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "design" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customization_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customization_drafts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "customization_drafts_userId_productId_key" ON "customization_drafts"("userId", "productId");
