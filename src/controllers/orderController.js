import { orderService } from '../services/orderService.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export const orderController = {
  getMyOrders: async (req, res, next) => {
    try {
      const result = await orderService.getUserOrders(req.user.id, req.query);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getAllOrders: async (req, res, next) => {
    try {
      const result = await orderService.getAllOrders(req.query);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const order = await orderService.getById(req.params.id, req.user.id, req.user.role);
      sendSuccess(res, { order });
    } catch (err) { next(err); }
  },

  createOrder: async (req, res, next) => {
    try {
      const order = await orderService.createFromCart(req.user.id, req.body);
      sendSuccess(res, { order }, 'Order placed successfully', HTTP_STATUS.CREATED);
    } catch (err) { next(err); }
  },

  updateStatus: async (req, res, next) => {
    try {
      const order = await orderService.updateStatus(req.params.id, req.body.status);
      sendSuccess(res, { order }, 'Order status updated');
    } catch (err) { next(err); }
  },
};
