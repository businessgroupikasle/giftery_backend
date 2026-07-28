import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Clean up ────────────────────────────────────────────────
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ───────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const userPassword  = await bcrypt.hash('User@123', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@giftery.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: userPassword,
      role: 'USER',
    },
  });

  console.log('✅ Users created');

  // ── Categories ──────────────────────────────────────────────
  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics', image: '/images/categories/electronics.jpg' },
  });

  const clothing = await prisma.category.create({
    data: { name: 'Clothing', slug: 'clothing', image: '/images/categories/clothing.jpg' },
  });

  const homeKitchen = await prisma.category.create({
    data: { name: 'Home & Kitchen', slug: 'home-kitchen', image: '/images/categories/home.jpg' },
  });

  const sports = await prisma.category.create({
    data: { name: 'Sports & Outdoors', slug: 'sports-outdoors', image: '/images/categories/sports.jpg' },
  });

  console.log('✅ Categories created');

  // ── Products ─────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Wireless Noise-Cancelling Headphones',
        slug: 'wireless-noise-cancelling-headphones',
        description: 'Premium over-ear headphones with industry-leading active noise cancellation, 30-hour battery life, and exceptional sound quality.',
        price: 349.99,
        comparePrice: 449.99,
        stock: 50,
        images: ['/images/products/headphones-1.jpg', '/images/products/headphones-2.jpg'],
        sku: 'ELEC-HEAD-001',
        featured: true,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Smart 4K OLED TV 55"',
        slug: 'smart-4k-oled-tv-55',
        description: 'Experience stunning picture quality with this 55" OLED display, featuring Dolby Vision, HDR10+, and built-in streaming apps.',
        price: 1299.99,
        comparePrice: 1599.99,
        stock: 20,
        images: ['/images/products/tv-1.jpg'],
        sku: 'ELEC-TV-001',
        featured: true,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Men\'s Classic Slim-Fit Shirt',
        slug: 'mens-classic-slim-fit-shirt',
        description: 'Crafted from 100% premium cotton, this slim-fit shirt offers a modern silhouette perfect for office or casual occasions.',
        price: 49.99,
        comparePrice: 79.99,
        stock: 200,
        images: ['/images/products/shirt-1.jpg', '/images/products/shirt-2.jpg'],
        sku: 'CLOT-MSH-001',
        featured: false,
        categoryId: clothing.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Stainless Steel Cookware Set (10-Piece)',
        slug: 'stainless-steel-cookware-set-10-piece',
        description: 'Professional-grade tri-ply stainless steel cookware set. Oven safe up to 500°F. Dishwasher safe.',
        price: 199.99,
        comparePrice: 299.99,
        stock: 35,
        images: ['/images/products/cookware-1.jpg'],
        sku: 'HOME-CWR-001',
        featured: true,
        categoryId: homeKitchen.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Yoga Mat — Premium Non-Slip',
        slug: 'yoga-mat-premium-non-slip',
        description: 'Extra-thick 6mm eco-friendly TPE yoga mat with alignment lines. Non-slip surface for stability during any pose.',
        price: 39.99,
        comparePrice: 59.99,
        stock: 100,
        images: ['/images/products/yoga-mat-1.jpg'],
        sku: 'SPRT-YOG-001',
        featured: false,
        categoryId: sports.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Mechanical Gaming Keyboard',
        slug: 'mechanical-gaming-keyboard',
        description: 'TKL tenkeyless RGB mechanical keyboard with Cherry MX Red switches, N-key rollover, and aluminum frame.',
        price: 129.99,
        comparePrice: 159.99,
        stock: 75,
        images: ['/images/products/keyboard-1.jpg'],
        sku: 'ELEC-KBD-001',
        featured: true,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Women\'s Running Shoes',
        slug: 'womens-running-shoes',
        description: 'Lightweight, breathable mesh upper with responsive foam cushioning. Perfect for daily training and long-distance runs.',
        price: 89.99,
        comparePrice: 119.99,
        stock: 150,
        images: ['/images/products/shoes-1.jpg', '/images/products/shoes-2.jpg'],
        sku: 'SPRT-WSH-001',
        featured: false,
        categoryId: sports.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Ceramic Coffee Mug Set (4-Pack)',
        slug: 'ceramic-coffee-mug-set-4-pack',
        description: 'Hand-crafted ceramic mugs in four earthy tones. 12oz capacity, microwave and dishwasher safe.',
        price: 29.99,
        comparePrice: 44.99,
        stock: 80,
        images: ['/images/products/mugs-1.jpg'],
        sku: 'HOME-MUG-001',
        featured: false,
        categoryId: homeKitchen.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Wireless Charging Pad',
        slug: 'wireless-charging-pad',
        description: '15W fast wireless charger compatible with all Qi-enabled devices. Ultra-slim design with LED indicator.',
        price: 24.99,
        comparePrice: 39.99,
        stock: 200,
        images: ['/images/products/charger-1.jpg'],
        sku: 'ELEC-CHG-001',
        featured: false,
        categoryId: electronics.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Denim Jacket — Vintage Wash',
        slug: 'denim-jacket-vintage-wash',
        description: 'Classic denim jacket with a vintage wash finish, button-up front, and two chest pockets. Unisex sizing.',
        price: 79.99,
        comparePrice: 99.99,
        stock: 60,
        images: ['/images/products/denim-1.jpg'],
        sku: 'CLOT-DEN-001',
        featured: false,
        categoryId: clothing.id,
      },
    }),
  ]);

  console.log(`✅ ${products.length} products created`);

  // ── Demo Order ───────────────────────────────────────────────
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      status: 'DELIVERED',
      totalAmount: 389.98,
      shippingAddress: {
        fullName: 'Jane Doe',
        street: '123 Main Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'US',
        phone: '+1-555-0123',
      },
      items: {
        create: [
          { productId: products[0].id, quantity: 1, price: products[0].price, name: products[0].name },
          { productId: products[5].id, quantity: 1, price: products[5].price, name: products[5].name },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      status: 'SUCCEEDED',
      amount: order.totalAmount,
      stripePaymentId: 'pi_demo_seed_payment_001',
    },
  });

  // ── Demo Reviews ─────────────────────────────────────────────
  await prisma.review.createMany({
    data: [
      {
        userId: customer.id,
        productId: products[0].id,
        rating: 5,
        comment: 'Absolutely incredible sound quality. The noise cancellation is best-in-class.',
      },
      {
        userId: customer.id,
        productId: products[5].id,
        rating: 4,
        comment: 'Great keyboard, very tactile. The RGB is a nice touch.',
      },
    ],
  });

  console.log('✅ Demo order + reviews created');

  console.log('\n🎉 Seed complete!');
  console.log('   Admin: admin@giftery.com / Admin@123');
  console.log('   User:  jane@example.com  / User@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
