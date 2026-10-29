import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';

export const cartRepository = {
  findByUserId: (userId) =>
    prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, price: true, images: true, stock: true },
            },
          },
        },
      },
    }),

  createForUser: (userId) => prisma.cart.create({ data: { userId }, include: { items: true } }),

  findItem: (cartId, productId) =>
    prisma.cartItem.findFirst({ where: { cartId, productId, customization: { equals: Prisma.DbNull } } }),

  addItem: (cartId, productId, quantity, customization) =>
    prisma.cartItem.create({ data: { cartId, productId, quantity, ...(customization ? { customization } : {}) } }),

  updateItem: (id, quantity) => prisma.cartItem.update({ where: { id }, data: { quantity } }),

  removeItem: (id) => prisma.cartItem.delete({ where: { id } }),

  clearCart: (cartId) => prisma.cartItem.deleteMany({ where: { cartId } }),
};
