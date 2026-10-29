import { cartRepository } from '../repositories/cartRepository.js';
import prisma from '../config/db.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { validateSavedCustomization } from './customizationService.js';

const getOrCreateCart = async (userId) => {
  await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  return cartRepository.findByUserId(userId);
};

const withCart = (userId, action) => prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
  const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, include: { items: { include: { product: true } } } });
  return action(tx, cart);
});

export const cartService = {
  getCart: async (userId) => {
    const cart = await getOrCreateCart(userId);
    const total = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    return { ...cart, total: Math.round(total * 100) / 100 };
  },

  addItem: async (userId, { productId, quantity, customization }) => {
    await withCart(userId, async (tx, cart) => {
    if (customization) await validateSavedCustomization(userId, productId, customization, tx);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    if (product.stock < quantity) {
      const err = new Error(`Only ${product.stock} units available`);
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const totalQuantity = cart.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, quantity);
    if (totalQuantity > product.stock) {
      const err = new Error(`Only ${product.stock} units available`);
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }
    const existing = customization ? null : cart.items.find((item) => item.productId === productId && item.customization === null);

    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } });
    } else {
      await tx.cartItem.create({ data: { cartId: cart.id, productId, quantity, ...(customization ? { customization } : {}) } });
    }
    });
    return cartService.getCart(userId);
  },

  updateItem: async (userId, itemId, { quantity }) => {
    await withCart(userId, async (tx, cart) => {
    const item = cart.items.find((entry) => entry.id === itemId);
    if (!item) { const err = new Error('Cart item not found'); err.statusCode = 404; throw err; }
    const total = cart.items.filter((entry) => entry.productId === item.productId && entry.id !== itemId).reduce((sum, entry) => sum + entry.quantity, quantity);
    if (total > item.product.stock) { const err = new Error(`Only ${item.product.stock} units available`); err.statusCode = 400; throw err; }
    await tx.cartItem.update({ where: { id: itemId }, data: { quantity } });
    });
    return cartService.getCart(userId);
  },

  removeItem: async (userId, itemId) => {
    await withCart(userId, async (tx, cart) => {
    if (!cart.items.some((item) => item.id === itemId)) { const err = new Error('Cart item not found'); err.statusCode = 404; throw err; }
    await tx.cartItem.delete({ where: { id: itemId } });
    });
    return cartService.getCart(userId);
  },

  clearCart: async (userId) => {
    await withCart(userId, (tx, cart) => tx.cartItem.deleteMany({ where: { cartId: cart.id } }));
    return cartService.getCart(userId);
  },
};
