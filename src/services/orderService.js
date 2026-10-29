import { orderRepository } from '../repositories/orderRepository.js';
import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { validateCustomization, validateSavedCustomization } from './customizationService.js';
import { calculateOrderPricing } from './orderPricing.js';

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
    if (!['ADMIN', 'SUPER_ADMIN', 'STORE_ADMIN'].includes(role) && order.userId !== userId) {
      const err = new Error('Access denied');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }
    return order;
  },

  createFromCart: async (userId, { items, shippingAddress, notes, paymentMethod = 'COD', couponCode, expectedTotal, totalAmount }) => {
    if (String(paymentMethod).toUpperCase() !== 'COD') { const err = new Error('Online payment is temporarily unavailable'); err.statusCode = 503; throw err; }
    const expected = expectedTotal ?? totalAmount;
    if (!Number.isFinite(expected) || expected < 0) { const err = new Error('Expected total is required'); err.statusCode = 400; throw err; }
    return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
    let orderItemsData = [];
    let calculatedTotal = 0;
    let cartItemIds = null;

    if (items && Array.isArray(items) && items.length > 0) {
      orderItemsData = items.map((item) => ({
        productId: item.productId || item.id,
        quantity: item.quantity,
        customization: item.customization || null,
      }));
    } else {
      // Pull from database Cart
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        const err = new Error('Cart is empty');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }

      cartItemIds = cart.items.map((item) => item.id);

      orderItemsData = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name,
        image: item.product.images[0] || null,
        customization: item.customization,
      }));

      calculatedTotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    }

    for (const item of orderItemsData) {
      if (item.customization) {
        await validateSavedCustomization(userId, item.productId, item.customization, tx);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) { const err = new Error('Invalid quantity'); err.statusCode = 400; throw err; }
    }

      calculatedTotal = 0;
      for (const item of orderItemsData) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.isActive || !Number.isFinite(product.price) || product.price < 0) { const err = new Error('Product unavailable'); err.statusCode = 400; throw err; }
        const unitPaise = Math.round(product.price * 100);
        item.price = unitPaise / 100;
        item.catalogPrice = product.price;
        item.name = product.name;
        item.image = product.images[0] || null;
        calculatedTotal += unitPaise * item.quantity;
        if (!Number.isSafeInteger(calculatedTotal)) { const err = new Error('Invalid order total'); err.statusCode = 400; throw err; }
      }
      const pricing = calculateOrderPricing(calculatedTotal, couponCode);
      if (Math.round(expected * 100) !== Math.round(pricing.totalAmount * 100)) {
        const err = new Error('Order total changed'); err.statusCode = 409; err.pricing = pricing; throw err;
      }
      for (const item of orderItemsData) {
        const updated = await tx.product.updateMany({ where: { id: item.productId, isActive: true, price: item.catalogPrice, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (!updated.count) { const err = new Error('Product not found or insufficient stock'); err.statusCode = 400; throw err; }
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: pricing.totalAmount,
          pricing,
          shippingAddress: shippingAddress || {},
          notes,
          payment: { create: { method: 'COD', amount: pricing.totalAmount, currency: 'INR' } },
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              name: item.name,
              image: item.image,
              ...(item.customization ? { customization: item.customization } : {}),
            })),
          },
        },
        include: { items: true },
      });

      if (cartItemIds) {
        const deleted = await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds }, cart: { userId } } });
        if (deleted.count !== cartItemIds.length) { const err = new Error('Cart changed during checkout'); err.statusCode = 409; throw err; }
      }

      return newOrder;
    });

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
