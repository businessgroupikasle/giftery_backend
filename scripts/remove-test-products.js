import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testSlugs = [
  'test-executive-welcome-gift-box',
  'test-premium-leather-notebook',
  'test-insulated-corporate-bottle',
  'test-wireless-desk-charging-kit',
  'test-custom-acrylic-photo-frame',
  'test-personalized-wooden-engraving',
  'test-custom-couple-caricature',
  'test-stem-learning-activity-kit',
  'test-remote-control-racing-car',
  'test-creative-building-blocks-set',
];

export async function removeTestProducts() {
  const testProducts = await prisma.product.findMany({
    where: {
      OR: [
        { slug: { in: testSlugs } },
        { slug: { startsWith: 'test-' } },
        { sku: { startsWith: 'TEST-GIFT-' } },
        { tags: { has: 'test-product' } },
      ],
    },
    select: { id: true, name: true, slug: true, sku: true },
  });

  if (testProducts.length === 0) {
    console.log('ℹ️ No test seed products found in database.');
    return { count: 0 };
  }

  const ids = testProducts.map((p) => p.id);
  console.log(`Found ${testProducts.length} test products to remove:`, testProducts.map((p) => p.name));

  // Remove dependencies first
  await prisma.cartItem.deleteMany({ where: { productId: { in: ids } } });
  await prisma.wishlistItem.deleteMany({ where: { productId: { in: ids } } });
  await prisma.review.deleteMany({ where: { productId: { in: ids } } });
  await prisma.orderItem.deleteMany({ where: { productId: { in: ids } } });

  const result = await prisma.product.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`✅ Successfully deleted ${result.count} test seed products from database.`);
  return result;
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('remove-test-products.js') ||
  process.argv[1].includes('remove-test-products')
);

if (isDirectRun) {
  removeTestProducts()
    .catch((err) => {
      console.error('❌ Error removing test products:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
