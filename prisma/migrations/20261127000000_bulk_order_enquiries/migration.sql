-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "company" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "productSku" TEXT,
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "enquiries_type_createdAt_idx" ON "enquiries"("type", "createdAt");

-- CreateIndex
CREATE INDEX "enquiries_productId_idx" ON "enquiries"("productId");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

