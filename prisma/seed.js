import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed for Categories & Admin Users...');

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

  // ── Users (Super Admin & Admin only) ─────────────────────────
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12);
  const adminPassword = await bcrypt.hash('Admin@123', 12);

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'superadmin@giftery.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Store Admin',
      email: 'admin@giftery.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin & Super Admin users created');

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

  for (const sub of corpSubcategories) {
    await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: corporateGifts.id,
        description: `${sub.name} under Corporate Gifts collection`,
        image: '/images/cat_corporate.png',
      },
    });
  }

  // ── 3. Personalized Gifts Subcategories (5 Subcategories) ─────────
  const personalizedSubcategories = [
    { name: 'Photo Frames', slug: 'photo-frames' },
    { name: 'Acrylic Frames', slug: 'acrylic-frames' },
    { name: 'Caricatures', slug: 'caricatures' },
    { name: 'Clocks', slug: 'clocks' },
    { name: 'Wooden Photo Engraving', slug: 'wooden-photo-engraving' },
  ];

  for (const sub of personalizedSubcategories) {
    await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: personalizedGifts.id,
        description: `${sub.name} under Personalized Gifts collection`,
        image: '/images/cat_welcome.png',
      },
    });
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

  for (const sub of toysSubcategories) {
    await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: toys.id,
        description: `${sub.name} under Toys collection`,
        image: '/images/cat_tech.png',
      },
    });
  }

  console.log('✅ All Subcategories created (16 Corporate + 5 Personalized + 12 Toys = 33 Subcategories)');
  console.log('\n🎉 Seed complete! Categories & Subcategories are loaded in Database!');
  console.log('   Admin Credentials: admin@giftery.com / Admin@123');
  console.log('   Super Admin: superadmin@giftery.com / SuperAdmin@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

