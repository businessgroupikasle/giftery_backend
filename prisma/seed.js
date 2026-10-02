import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed for Categories & Admin Users...');

  // ── Sync Seed Assets to Environment-based Upload Directory ───
  const uploadDirEnv = process.env.UPLOAD_DIR || 'Uploads';
  const uploadPath = path.isAbsolute(uploadDirEnv)
    ? uploadDirEnv
    : path.resolve(process.cwd(), uploadDirEnv);

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const seedAssetsDir = path.resolve(__dirname, '../seed-assets');
  if (fs.existsSync(seedAssetsDir)) {
    const seedFiles = fs.readdirSync(seedAssetsDir);
    let count = 0;
    for (const file of seedFiles) {
      const srcFile = path.join(seedAssetsDir, file);
      const destFile = path.join(uploadPath, file);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, destFile);
        count++;
      }
    }
    console.log(`📁 Synced ${count} seed asset files to ${uploadPath}`);
  }

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

  console.log(' Admin & Super Admin users created');

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

  console.log('Main Categories created (Corporate Gifts, Personalized Gifts, Toys)');

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

  console.log(' All Subcategories created (16 Corporate + 5 Personalized + 12 Toys = 33 Subcategories)');

  // ── 5. Products (distributed across all main categories) ─────────────
  const productSubcategories = await prisma.category.findMany({
    where: {
      slug: {
        in: [
          'onboarding-kit', 'drinkware', 'electronics', 'trophies-awards',
          'photo-frames', 'caricatures', 'wooden-photo-engraving',
          'educational-toys', 'remote-control-toys', 'soft-toys',
        ],
      },
    },
    select: { id: true, slug: true },
  });

  const subcategoryIdBySlug = Object.fromEntries(
    productSubcategories.map((subcategory) => [subcategory.slug, subcategory.id]),
  );

  const products = [
    {
      name: 'Premium Employee Welcome Kit', slug: 'premium-employee-welcome-kit',
      description: 'A polished onboarding gift set with a notebook, bottle, pen and welcome card.',
      price: 2499, comparePrice: 2999, stock: 40,
      images: ['https://placehold.co/800x800?text=Welcome+Kit'], sku: 'CG-WELCOME-001',
      featured: true, isGiftSet: true, categoryId: corporateGifts.id,
      subCategoryId: subcategoryIdBySlug['onboarding-kit'], tags: ['corporate', 'onboarding', 'gift-set'],
    },
    {
      name: 'Insulated Corporate Travel Tumbler', slug: 'insulated-corporate-travel-tumbler',
      description: 'Double-wall insulated stainless-steel tumbler suitable for company branding.',
      price: 899, comparePrice: 1099, stock: 75,
      images: ['https://placehold.co/800x800?text=Travel+Tumbler'], sku: 'CG-TUMBLER-002',
      isPopular: true, categoryId: corporateGifts.id,
      subCategoryId: subcategoryIdBySlug.drinkware, tags: ['corporate', 'drinkware', 'office'],
    },
    {
      name: 'Wireless Charging Desk Organizer', slug: 'wireless-charging-desk-organizer',
      description: 'A modern desk organizer with an integrated wireless charging pad.',
      price: 1799, comparePrice: 2199, stock: 30,
      images: ['https://placehold.co/800x800?text=Desk+Organizer'], sku: 'CG-ELECTRONICS-003',
      isNewArrival: true, categoryId: corporateGifts.id,
      subCategoryId: subcategoryIdBySlug.electronics, tags: ['corporate', 'electronics', 'desk'],
    },
    {
      name: 'Crystal Excellence Award', slug: 'crystal-excellence-award',
      description: 'Elegant crystal award for employee recognition, milestones and achievements.',
      price: 1499, stock: 25,
      images: ['https://placehold.co/800x800?text=Crystal+Award'], sku: 'CG-AWARD-004',
      isBestseller: true, categoryId: corporateGifts.id,
      subCategoryId: subcategoryIdBySlug['trophies-awards'], tags: ['corporate', 'award', 'recognition'],
    },
    {
      name: 'Personalized Family Photo Frame', slug: 'personalized-family-photo-frame',
      description: 'Custom family photo frame with a personalized name and message.',
      price: 999, comparePrice: 1299, stock: 50,
      images: ['https://placehold.co/800x800?text=Photo+Frame'], sku: 'PG-FRAME-001',
      featured: true, isMostLoved: true, categoryId: personalizedGifts.id,
      subCategoryId: subcategoryIdBySlug['photo-frames'], tags: ['personalized', 'photo', 'family'],
    },
    {
      name: 'Custom Couple Caricature Stand', slug: 'custom-couple-caricature-stand',
      description: 'A cheerful custom couple caricature printed on a premium tabletop stand.',
      price: 1299, stock: 35,
      images: ['https://placehold.co/800x800?text=Couple+Caricature'], sku: 'PG-CARICATURE-002',
      isPopular: true, categoryId: personalizedGifts.id,
      subCategoryId: subcategoryIdBySlug.caricatures, tags: ['personalized', 'couple', 'caricature'],
    },
    {
      name: 'Engraved Wooden Memory Plaque', slug: 'engraved-wooden-memory-plaque',
      description: 'Natural wood plaque engraved with a favorite photograph and personal message.',
      price: 1599, comparePrice: 1899, stock: 20,
      images: ['https://placehold.co/800x800?text=Wooden+Plaque'], sku: 'PG-WOOD-003',
      isNewArrival: true, categoryId: personalizedGifts.id,
      subCategoryId: subcategoryIdBySlug['wooden-photo-engraving'], tags: ['personalized', 'wooden', 'engraving'],
    },
    {
      name: 'Junior Science Experiment Kit', slug: 'junior-science-experiment-kit',
      description: 'A hands-on science kit with safe experiments that encourage curiosity and learning.',
      price: 1199, comparePrice: 1499, stock: 60,
      images: ['https://placehold.co/800x800?text=Science+Kit'], sku: 'TOY-SCIENCE-001',
      isBestseller: true, categoryId: toys.id,
      subCategoryId: subcategoryIdBySlug['educational-toys'], tags: ['toys', 'educational', 'science'],
    },
    {
      name: 'Remote Control Racing Car', slug: 'remote-control-racing-car',
      description: 'Rechargeable remote-control racing car with responsive steering and LED lights.',
      price: 1899, comparePrice: 2299, stock: 45,
      images: ['https://placehold.co/800x800?text=RC+Racing+Car'], sku: 'TOY-RC-002',
      featured: true, categoryId: toys.id,
      subCategoryId: subcategoryIdBySlug['remote-control-toys'], tags: ['toys', 'remote-control', 'racing'],
    },
    {
      name: 'Cuddly Teddy Bear', slug: 'cuddly-teddy-bear',
      description: 'A soft, huggable teddy bear made with child-friendly fabric and filling.',
      price: 799, stock: 80,
      images: ['https://placehold.co/800x800?text=Teddy+Bear'], sku: 'TOY-SOFT-003',
      isMostLoved: true, categoryId: toys.id,
      subCategoryId: subcategoryIdBySlug['soft-toys'], tags: ['toys', 'soft-toy', 'teddy'],
    },
  ];

  await prisma.product.createMany({ data: products });

  console.log(' 10 Products created (4 Corporate + 3 Personalized + 3 Toys)');
  console.log('\n Seed complete! Categories, Subcategories & Products are loaded in Database!');
  console.log('   Admin Credentials: admin@giftery.com / Admin@123');
  console.log('   Super Admin: superadmin@giftery.com / SuperAdmin@123');
}

main()
  .catch((e) => {
    console.error(' Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

