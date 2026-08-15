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

  createFromCart: async (userId, { items, shippingAddress, notes, totalAmount }) => {
    let orderItemsData = [];
    let calculatedTotal = 0;

    if (items && Array.isArray(items) && items.length > 0) {
      // Direct items passed (Buy Now or client checkout)
      orderItemsData = items.map((item) => ({
        productId: item.productId || item.id,
        quantity: item.quantity || 1,
        price: parseFloat(item.price) || 0,
        name: item.name || 'Product',
        image: item.image || (Array.isArray(item.images) ? item.images[0] : null),
      }));

      calculatedTotal = orderItemsData.reduce((sum, item) => sum + item.price * item.quantity, 0);
    } else {
      // Pull from database Cart
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        const err = new Error('Cart is empty');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }

      orderItemsData = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name,
        image: item.product.images[0] || null,
      }));

      calculatedTotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    }

    const finalTotal = totalAmount !== undefined ? parseFloat(totalAmount) : calculatedTotal;

    const order = await prisma.$transaction(async (tx) => {
      // Decrement stock for products that exist in DB
      for (const item of orderItemsData) {
        if (item.productId && !item.productId.startsWith('prod-')) {
          try {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          } catch (e) {}
        }
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: Math.round(finalTotal * 100) / 100,
          shippingAddress: shippingAddress || {},
          notes,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              name: item.name,
              image: item.image,
            })),
          },
        },
        include: { items: true },
      });

      // Clear database cart if user had cart items
      try {
        const userCart = await tx.cart.findUnique({ where: { userId } });
        if (userCart) {
          await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
        }
      } catch (e) {}

      return newOrder;
    });

    return order;
  },

  updateStatus: async (id, status) => {
    const normalizedStatus = String(status).trim().toUpperCase();
    let order = await orderRepository.findById(id);
    if (!order) {
      order = await prisma.order.findFirst({ where: { id } });
    }
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    return orderRepository.updateStatus(order.id, normalizedStatus);
  },
};
