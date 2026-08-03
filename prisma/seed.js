import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting full seed for Main Categories, Subcategories & Products...');

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
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12);
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const userPassword  = await bcrypt.hash('User@123', 12);

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'superadmin@giftery.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Store Admin',
      email: 'admin@giftery.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: 'Jane Doe',
      email: 'user@giftery.com',
      password: userPassword,
      role: 'USER',
    },
  });

  console.log('✅ Users created');

  // ── 1. Main Categories ──────────────────────────────────────────
  const corporateGifts = await prisma.category.create({
    data: {
      name: 'Corporate Gifts',
      slug: 'corporate-gifts',
      description: 'Onboarding kits, executive desk accessories, drinkware, apparel & premium corporate gifting.',
      image: '/images/cat_corporate.png',
    },
  });

  const personalizedGifts = await prisma.category.create({
    data: {
      name: 'Personalized Gifts',
      slug: 'personalized-gifts',
      description: 'Photo frames, acrylic stands, caricatures, clocks & custom wooden photo engravings.',
      image: '/images/cat_welcome.png',
    },
  });

  const toys = await prisma.category.create({
    data: {
      name: 'Toys',
      slug: 'toys',
      description: 'Educational toys, remote control cars, building blocks, soft toys & dolls for all age groups.',
      image: '/images/cat_tech.png',
    },
  });

  console.log('✅ Main Categories created (Corporate Gifts, Personalized Gifts, Toys)');

  // ── 2. Corporate Gifts Subcategories (16 Subcategories) ─────────────
  const corpSubcategories = [
    { name: 'Onboarding Kit', slug: 'onboarding-kit' },
    { name: 'Work Anniversary Kit', slug: 'work-anniversary-kit' },
    { name: 'Employee Anniversary Kit', slug: 'employee-anniversary-kit' },
    { name: 'Diaries & Notebooks', slug: 'diaries-notebooks' },
    { name: 'Drinkware', slug: 'drinkware' },
    { name: 'Apparel', slug: 'apparel' },
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Backpacks', slug: 'backpacks' },
    { name: 'Accessories', slug: 'accessories' },
    { name: 'Trophies & Awards', slug: 'trophies-awards' },
    { name: 'Caps', slug: 'caps' },
    { name: 'Umbrellas', slug: 'umbrellas' },
    { name: 'Card Holders', slug: 'card-holders' },
    { name: 'Premium Gifts', slug: 'premium-gifts' },
    { name: 'Cups & Mugs', slug: 'cups-mugs' },
    { name: 'Keychains', slug: 'keychains' },
  ];

  const corpSubCategoryMap = {};
  for (const sub of corpSubcategories) {
    const created = await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: corporateGifts.id,
        description: `${sub.name} under Corporate Gifts collection`,
        image: '/images/cat_corporate.png',
      },
    });
    corpSubCategoryMap[sub.slug] = created;
  }

  // ── 3. Personalized Gifts Subcategories (5 Subcategories) ─────────
  const personalizedSubcategories = [
    { name: 'Photo Frames', slug: 'photo-frames' },
    { name: 'Acrylic Frames', slug: 'acrylic-frames' },
    { name: 'Caricatures', slug: 'caricatures' },
    { name: 'Clocks', slug: 'clocks' },
    { name: 'Wooden Photo Engraving', slug: 'wooden-photo-engraving' },
  ];

  const persSubCategoryMap = {};
  for (const sub of personalizedSubcategories) {
    const created = await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: personalizedGifts.id,
        description: `${sub.name} under Personalized Gifts collection`,
        image: '/images/cat_welcome.png',
      },
    });
    persSubCategoryMap[sub.slug] = created;
  }

  // ── 4. Toys Subcategories (12 Subcategories) ──────────────────────
  const toysSubcategories = [
    { name: '0 – 2 Years', slug: '0-2-years' },
    { name: '3 – 5 Years', slug: '3-5-years' },
    { name: '6 – 8 Years', slug: '6-8-years' },
    { name: '9 – 12 Years', slug: '9-12-years' },
    { name: 'Teens', slug: 'teens' },
    { name: 'Educational Toys', slug: 'educational-toys' },
    { name: 'Remote Control Toys', slug: 'remote-control-toys' },
    { name: 'Soft Toys', slug: 'soft-toys' },
    { name: 'Building Blocks', slug: 'building-blocks' },
    { name: 'Dolls', slug: 'dolls' },
    { name: 'Cars & Bikes', slug: 'cars-bikes' },
    { name: 'Outdoor Toys', slug: 'outdoor-toys' },
  ];

  const toysSubCategoryMap = {};
  for (const sub of toysSubcategories) {
    const created = await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: toys.id,
        description: `${sub.name} under Toys collection`,
        image: '/images/cat_tech.png',
      },
    });
    toysSubCategoryMap[sub.slug] = created;
  }

  console.log('✅ All Subcategories created (16 Corporate + 5 Personalized + 12 Toys = 33 Subcategories)');

  // ── 5. Products Seeding ──────────────────────────────────────────
  const products = await Promise.all([
    // Corporate Gifts Products
    prisma.product.create({
      data: {
        name: 'Executive Kinetic Desk Gyro Sculpture',
        slug: 'executive-kinetic-desk-gyro-sculpture',
        description: 'Make a lasting first impression with our Executive Kinetic Desk Gyro Sculpture. Perfect for onboarding new executives and luxury corporate gifting.',
        price: 1499,
        comparePrice: 1999,
        stock: 50,
        images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80'],
        sku: 'CORP-GYRO-001',
        featured: true,
        categoryId: corpSubCategoryMap['onboarding-kit']?.id || corporateGifts.id,
      },
    }),
    prisma.product.create({
      data: {
        name: '3D Wooden Mechanical Gear Clock Puzzle',
        slug: '3d-wooden-mechanical-gear-clock-puzzle',
        description: 'Exquisite handcrafted 3D wooden gear clock puzzle. Combines mechanical art with functional quartz timekeeping.',
        price: 2199,
        comparePrice: 2799,
        stock: 40,
        images: ['https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80'],
        sku: 'CORP-CLK-002',
        featured: true,
        categoryId: corpSubCategoryMap['work-anniversary-kit']?.id || corporateGifts.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Executive Stainless Steel Hydration Bottle',
        slug: 'executive-stainless-steel-hydration-bottle',
        description: 'Double-wall vacuum insulated stainless steel bottle. Keeps drinks cold for 24 hours and hot for 12 hours.',
        price: 799,
        comparePrice: 999,
        stock: 85,
        images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80'],
        sku: 'CORP-DRINK-003',
        featured: true,
        categoryId: corpSubCategoryMap['drinkware']?.id || corporateGifts.id,
      },
    }),

    // Personalized Gifts Products
    prisma.product.create({
      data: {
        name: 'Personalized Leather Notebook & Pen Set',
        slug: 'personalized-leather-notebook-pen-set',
        description: 'Custom embossed PU leather notebook with metallic pen. Premium office gift for team members and corporate clients.',
        price: 899,
        comparePrice: 1299,
        stock: 100,
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'],
        sku: 'PERS-NOTE-001',
        featured: true,
        categoryId: persSubCategoryMap['wooden-photo-engraving']?.id || personalizedGifts.id,
      },
    }),
    prisma.product.create({
      data: {
        name: '3D Acrylic Photo Standee with LED Base',
        slug: '3d-acrylic-photo-standee-led-base',
        description: 'Custom laser engraved acrylic photo frame with warm LED wooden base. Cherish special memories with custom lighting.',
        price: 1299,
        comparePrice: 1699,
        stock: 65,
        images: ['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80'],
        sku: 'PERS-ACRY-002',
        featured: true,
        categoryId: persSubCategoryMap['acrylic-frames']?.id || personalizedGifts.id,
      },
    }),

    // Toys Products
    prisma.product.create({
      data: {
        name: 'Remote Control High-Speed Stunt Car',
        slug: 'remote-control-high-speed-stunt-car',
        description: '360-degree rotating RC stunt car with LED headlights and rechargeable battery. Fun toy for kids aged 6-12.',
        price: 1899,
        comparePrice: 2499,
        stock: 80,
        images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80'],
        sku: 'TOYS-RC-001',
        featured: true,
        categoryId: toysSubCategoryMap['remote-control-toys']?.id || toys.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Educational STEM Building Blocks Set',
        slug: 'educational-stem-building-blocks-set',
        description: 'Interactive 250-piece building block kit designed to encourage spatial learning and creativity in young minds.',
        price: 1199,
        comparePrice: 1599,
        stock: 60,
        images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80'],
        sku: 'TOYS-STEM-002',
        featured: true,
        categoryId: toysSubCategoryMap['building-blocks']?.id || toys.id,
      },
    }),
  ]);

  console.log(`✅ ${products.length} Products created across subcategories`);

  // ── 6. Demo Order & Payment ──────────────────────────────────────
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      status: 'DELIVERED',
      totalAmount: 3398.0,
      shippingAddress: {
        fullName: 'Jane Doe',
        street: '123 Luxury Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zip: '600001',
        country: 'India',
        phone: '+91-9876543210',
      },
      items: {
        create: [
          { productId: products[0].id, quantity: 1, price: products[0].price, name: products[0].name },
          { productId: products[1].id, quantity: 1, price: products[1].price, name: products[1].name },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      status: 'SUCCEEDED',
      amount: order.totalAmount,
      stripePaymentId: 'pay_demo_seed_payment_001',
    },
  });

  // ── Demo Reviews ─────────────────────────────────────────────
  await prisma.review.createMany({
    data: [
      {
        userId: customer.id,
        productId: products[0].id,
        rating: 5,
        comment: 'Absolutely top-notch executive desk sculpture quality!',
      },
      {
        userId: customer.id,
        productId: products[1].id,
        rating: 5,
        comment: 'Beautiful 3D gear clock puzzle. Great for corporate gifting!',
      },
    ],
  });

  console.log('✅ Demo order + reviews created');

  console.log('\n🎉 Seed complete! All Categories & Subcategories are loaded in Database!');
  console.log('   Admin Credentials: admin@giftery.com / Admin@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
