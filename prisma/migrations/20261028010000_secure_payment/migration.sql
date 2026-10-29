ALTER TABLE "payments" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'COD', ADD COLUMN "razorpayOrderId" TEXT, ADD COLUMN "razorpayPaymentId" TEXT;
ALTER TABLE "orders" ADD COLUMN "pricing" JSONB;
CREATE UNIQUE INDEX "payments_razorpayOrderId_key" ON "payments"("razorpayOrderId");
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");
