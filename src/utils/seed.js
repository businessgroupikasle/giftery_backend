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

    // Seed Customer User
    const userEmail = 'user@giftery.com';
    const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash('User@123', 12);
      await prisma.user.create({
        data: {
          name: 'John Doe',
          email: userEmail,
          password: hashedPassword,
          role: 'USER',
          isActive: true,
        },
      });
      logger.info(`✅ Demo Customer created: ${userEmail}`);
    }

    logger.info('🌱 Database seeding check complete.');
  } catch (err) {
    logger.warn('⚠️ Seeding note:', err.message);
  }
};
