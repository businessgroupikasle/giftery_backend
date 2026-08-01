import prisma from '../config/db.js';

export const authRepository = {
  findByEmail: (email) =>
    prisma.user.findUnique({ where: { email } }),

  findById: (id) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, avatar: true, phone: true, isEmailVerified: true, createdAt: true },
    }),

  create: (data) =>
    prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true, isEmailVerified: true, createdAt: true },
    }),

  update: (id, data) =>
    prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isEmailVerified: true, createdAt: true },
    }),

  updatePassword: (id, password) =>
    prisma.user.update({ where: { id }, data: { password } }),
};
