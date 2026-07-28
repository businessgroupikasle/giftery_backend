import { cartRepository } from '../repositories/cartRepository.js';
import prisma from '../config/db.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

const getOrCreateCart = async (userId) => {
  let cart = await cartRepository.findByUserId(userId);
  if (!cart) cart = await cartRepository.createForUser(userId);
  return cart;
};

export const cartService = {
  getCart: async (userId) => {
    const cart = await getOrCreateCart(userId);
    const total = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    return { ...cart, total: Math.round(total * 100) / 100 };
  },

  addItem: async (userId, { productId, quantity }) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
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

    const cart = await getOrCreateCart(userId);
    const existing = await cartRepository.findItem(cart.id, productId);

    if (existing) {
      await cartRepository.updateItem(existing.id, existing.quantity + quantity);
    } else {
      await cartRepository.addItem(cart.id, productId, quantity);
    }
    return cartService.getCart(userId);
  },

  updateItem: async (userId, itemId, { quantity }) => {
    await cartRepository.updateItem(itemId, quantity);
    return cartService.getCart(userId);
  },

  removeItem: async (userId, itemId) => {
    await cartRepository.removeItem(itemId);
    return cartService.getCart(userId);
  },

  clearCart: async (userId) => {
    const cart = await getOrCreateCart(userId);
    await cartRepository.clearCart(cart.id);
    return cartService.getCart(userId);
  },
};
