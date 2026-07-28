import { cartService } from '../services/cartService.js';
import { sendSuccess } from '../utils/response.js';

export const cartController = {
  getCart: async (req, res, next) => {
    try {
      const cart = await cartService.getCart(req.user.id);
      sendSuccess(res, { cart });
    } catch (err) { next(err); }
  },

  addItem: async (req, res, next) => {
    try {
      const cart = await cartService.addItem(req.user.id, req.body);
      sendSuccess(res, { cart }, 'Item added to cart');
    } catch (err) { next(err); }
  },

  updateItem: async (req, res, next) => {
    try {
      const cart = await cartService.updateItem(req.user.id, req.params.itemId, req.body);
      sendSuccess(res, { cart }, 'Cart item updated');
    } catch (err) { next(err); }
  },

  removeItem: async (req, res, next) => {
    try {
      const cart = await cartService.removeItem(req.user.id, req.params.itemId);
      sendSuccess(res, { cart }, 'Item removed from cart');
    } catch (err) { next(err); }
  },

  clearCart: async (req, res, next) => {
    try {
      const cart = await cartService.clearCart(req.user.id);
      sendSuccess(res, { cart }, 'Cart cleared');
    } catch (err) { next(err); }
  },
};
