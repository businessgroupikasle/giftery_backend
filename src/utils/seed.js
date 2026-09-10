import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { logger } from '../config/logger.js';

export const seedDatabase = async () => {
  try {
    logger.info('🌱 Checking and seeding initial database data...');

    // Seed Super Admin
    const superAdminEmail = 'superadmin@giftery.com';
    const existingSuperAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash('SuperAdmin@123', 12);
      try {
        await prisma.user.create({
          data: {
            name: 'Super Admin',
            email: superAdminEmail,
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        });
      } catch {
        await prisma.user.create({
          data: {
            name: 'Super Admin',
            email: superAdminEmail,
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
          },
        });
      }
      logger.info(`✅ Super Admin created: ${superAdminEmail}`);
    }

    // Seed Admin
    const adminEmail = 'admin@giftery.com';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      await prisma.user.create({
        data: {
          name: 'Store Admin',
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
        },
      });
      logger.info(`✅ Store Admin created: ${adminEmail}`);
    }

    // Clean up test seed products if any exist
    const testProducts = await prisma.product.findMany({
      where: {
        OR: [
          { slug: { startsWith: 'test-' } },
          { sku: { startsWith: 'TEST-GIFT-' } },
          { tags: { has: 'test-product' } },
        ],
      },
      select: { id: true, name: true },
    });

    if (testProducts.length > 0) {
      const ids = testProducts.map((p) => p.id);
      await prisma.cartItem.deleteMany({ where: { productId: { in: ids } } });
      await prisma.wishlistItem.deleteMany({ where: { productId: { in: ids } } });
      await prisma.review.deleteMany({ where: { productId: { in: ids } } });
      await prisma.orderItem.deleteMany({ where: { productId: { in: ids } } });
      const delResult = await prisma.product.deleteMany({ where: { id: { in: ids } } });
      logger.info(`🗑️ Removed ${delResult.count} test seed products from database.`);
    }

    logger.info('🌱 Database seeding check complete.');
  } catch (err) {
    logger.warn('⚠️ Seeding note:', err.message);
  }
};
