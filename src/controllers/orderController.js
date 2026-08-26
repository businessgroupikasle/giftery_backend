import { orderService } from '../services/orderService.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emitOrderCreated } from '../sockets/index.js';
import prisma from '../config/db.js';

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

      // Fetch user name/email for rich live notification
      let customerName = order.shippingAddress?.fullName || 'Customer';
      let customerEmail = '';
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, email: true } });
        if (u) {
          customerName = u.name || customerName;
          customerEmail = u.email || '';
        }
      } catch (e) {}

      // Emit Socket.IO event only after database transaction succeeds
      emitOrderCreated({
        id: order.id,
        orderId: order.id,
        customer: customerName,
        customerEmail,
        amount: order.totalAmount,
        totalAmount: order.totalAmount,
        itemsCount: order.items?.length || 1,
        items: order.items,
        status: order.status || 'PENDING',
        createdAt: order.createdAt || new Date().toISOString(),
      });

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
