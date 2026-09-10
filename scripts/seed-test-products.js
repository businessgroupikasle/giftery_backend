import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  { name: 'Executive Welcome Gift Box', slug: 'test-executive-welcome-gift-box', price: 1499, comparePrice: 1799, stock: 40, category: 'corporate-gifts', subcategory: 'onboarding-kit', image: '/images/prod_gift_set.png', featured: true, isGiftSet: true },
  { name: 'Premium Leather Notebook', slug: 'test-premium-leather-notebook', price: 649, comparePrice: 799, stock: 75, category: 'corporate-gifts', subcategory: 'diaries-notebooks', image: '/images/prod_diary.png', isBestseller: true },
  { name: 'Insulated Corporate Bottle', slug: 'test-insulated-corporate-bottle', price: 899, comparePrice: 1099, stock: 55, category: 'corporate-gifts', subcategory: 'drinkware', image: '/images/prod_bottle.png', isPopular: true },
  { name: 'Wireless Desk Charging Kit', slug: 'test-wireless-desk-charging-kit', price: 1899, comparePrice: 2299, stock: 24, category: 'corporate-gifts', subcategory: 'electronics', image: '/images/prod_tech.png', isNewArrival: true },
  { name: 'Custom Acrylic Photo Frame', slug: 'test-custom-acrylic-photo-frame', price: 799, comparePrice: 999, stock: 35, category: 'personalized-gifts', subcategory: 'acrylic-frames', image: '/images/prod_frame.png', isMostLoved: true },
  { name: 'Personalized Wooden Engraving', slug: 'test-personalized-wooden-engraving', price: 1199, comparePrice: 1499, stock: 20, category: 'personalized-gifts', subcategory: 'wooden-photo-engraving', image: '/images/prod_wooden.png', featured: true },
  { name: 'Custom Couple Caricature', slug: 'test-custom-couple-caricature', price: 999, comparePrice: 1299, stock: 30, category: 'personalized-gifts', subcategory: 'caricatures', image: '/images/prod_caricature.png', isPopular: true },
  { name: 'STEM Learning Activity Kit', slug: 'test-stem-learning-activity-kit', price: 1299, comparePrice: 1599, stock: 45, category: 'toys', subcategory: 'educational-toys', image: '/images/prod_toy.png', isBestseller: true },
  { name: 'Remote Control Racing Car', slug: 'test-remote-control-racing-car', price: 1699, comparePrice: 1999, stock: 28, category: 'toys', subcategory: 'remote-control-toys', image: '/images/prod_rc_car.png', isNewArrival: true },
  { name: 'Creative Building Blocks Set', slug: 'test-creative-building-blocks-set', price: 1099, comparePrice: 1399, stock: 60, category: 'toys', subcategory: 'building-blocks', image: '/images/prod_blocks.png', isGiftSet: true },
];

async function main() {
  const categories = await prisma.category.findMany();
  const bySlug = new Map(categories.map((category) => [category.slug, category]));

  for (let index = 0; index < products.length; index += 1) {
    const item = products[index];
    const category = bySlug.get(item.category);
    const subcategory = bySlug.get(item.subcategory);

    if (!category || !subcategory) {
      throw new Error(`Missing category for ${item.name}: ${item.category}/${item.subcategory}`);
    }

    const data = {
      name: item.name,
      description: `${item.name} created for cart, checkout, wishlist, and product-page testing.`,
      price: item.price,
      comparePrice: item.comparePrice,
      stock: item.stock,
      images: [item.image],
      sku: `TEST-GIFT-${String(index + 1).padStart(3, '0')}`,
      featured: Boolean(item.featured),
      isBestseller: Boolean(item.isBestseller),
      isPopular: Boolean(item.isPopular),
      isNewArrival: Boolean(item.isNewArrival),
      isMostLoved: Boolean(item.isMostLoved),
      isGiftSet: Boolean(item.isGiftSet),
      isActive: true,
      categoryId: category.id,
      subCategoryId: subcategory.id,
      tags: ['test-product', item.category, item.subcategory],
      rating: 4.8,
      reviewsCount: 24,
    };

    await prisma.product.upsert({
      where: { slug: item.slug },
      update: data,
      create: { ...data, slug: item.slug },
    });
  }

  const total = await prisma.product.count({
    where: { slug: { startsWith: 'test-' } },
  });
  console.log(`Seeded 10 test products. Test-product total: ${total}`);
}

main()
  .catch((error) => {
    console.error('Test product seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
