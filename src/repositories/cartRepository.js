import prisma from '../config/db.js';

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
    prisma.cartItem.findUnique({ where: { cartId_productId: { cartId, productId } } }),

  addItem: (cartId, productId, quantity) =>
    prisma.cartItem.create({ data: { cartId, productId, quantity } }),

  updateItem: (id, quantity) => prisma.cartItem.update({ where: { id }, data: { quantity } }),

  removeItem: (id) => prisma.cartItem.delete({ where: { id } }),

  clearCart: (cartId) => prisma.cartItem.deleteMany({ where: { cartId } }),
};
