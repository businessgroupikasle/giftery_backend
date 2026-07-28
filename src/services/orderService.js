import { orderRepository } from '../repositories/orderRepository.js';
import { cartRepository } from '../repositories/cartRepository.js';
import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export const orderService = {
  getUserOrders: async (userId, query) => {
    const total = await orderRepository.countByUserId(userId);
    const meta = paginate(query.page, query.limit, total);
    const data = await orderRepository.findByUserId(userId, meta);
    return paginatedResponse(data, meta);
  },

  getAllOrders: async (query) => {
    const where = query.status ? { status: query.status } : {};
    const total = await orderRepository.countAll(where);
    const meta = paginate(query.page, query.limit, total);
    const data = await orderRepository.findAll({ ...meta, where });
    return paginatedResponse(data, meta);
  },

  getById: async (id, userId, role) => {
    const order = await orderRepository.findById(id);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    if (role !== 'ADMIN' && order.userId !== userId) {
      const err = new Error('Access denied');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }
    return order;
  },

  createFromCart: async (userId, { shippingAddress, notes }) => {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      const err = new Error('Cart is empty');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Validate stock
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        const err = new Error(`Insufficient stock for "${item.product.name}"`);
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }
    }

    const totalAmount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    const order = await prisma.$transaction(async (tx) => {
      // Decrement stock
      for (const item of cart.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: Math.round(totalAmount * 100) / 100,
          shippingAddress,
          notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
              name: item.product.name,
              image: item.product.images[0] || null,
            })),
          },
        },
        include: { items: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return newOrder;
    });

    return order;
  },

  updateStatus: async (id, status) => {
    const order = await orderRepository.findById(id);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    return orderRepository.updateStatus(id, status);
  },
};
