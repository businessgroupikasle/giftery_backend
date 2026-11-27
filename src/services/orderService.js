import { orderRepository } from '../repositories/orderRepository.js';
import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { customizationCharge, loadPurchasableDesign, validateSnapshotAssets } from './customizationService.js';
import { calculateOrderPricing } from './orderPricing.js';

/** Validates and prices an order inside `tx` without writing anything. */
async function prepareOrder(tx, userId, { items, couponCode, expectedTotal, totalAmount }) {
  const expected = expectedTotal ?? totalAmount;
  if (!Number.isFinite(expected) || expected < 0) { const err = new Error('Expected total is required'); err.statusCode = 400; throw err; }
  await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
  let orderItemsData = [];
  let calculatedTotal = 0;
  let cartItemIds = null;
  let cartSnapshot = null;

  if (items && Array.isArray(items) && items.length > 0) {
    orderItemsData = items.map((item) => ({
      productId: item.productId || item.id,
      quantity: item.quantity,
      customizationId: item.customizationId || null,
      // Only an ID is honoured: the snapshot is rebuilt below from the customer's saved design.
      customization: null,
      unsavedCustomization: Boolean(item.customization && !item.customizationId),
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
    cartSnapshot = cart.items.map((item) => `${item.id}:${item.quantity}`).sort().join(',');

    orderItemsData = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.product.price,
      name: item.product.name,
      image: item.product.images[0] || null,
      customization: item.customization,
      customizationId: item.customizationId,
      fromCart: true,
    }));

    calculatedTotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  for (const item of orderItemsData) {
    if (item.unsavedCustomization) {
      const err = new Error('Save the current customization and preview before adding it to your cart'); err.statusCode = 400; throw err;
    }
    if (item.fromCart) {
      if (item.customization) await validateSnapshotAssets(userId, item.customization, tx);
    } else if (item.customizationId) {
      item.customization = await loadPurchasableDesign(userId, item.productId, item.customizationId, tx);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) { const err = new Error('Invalid quantity'); err.statusCode = 400; throw err; }
  }

  calculatedTotal = 0;
  const requested = new Map();
  for (const item of orderItemsData) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product || !product.isActive || !Number.isFinite(product.price) || product.price < 0) { const err = new Error('Product unavailable'); err.statusCode = 400; throw err; }
    // Checked here (read only) so an online payment is never started for stock we do not have.
    requested.set(product.id, (requested.get(product.id) || 0) + item.quantity);
    if (Number.isFinite(product.stock) && product.stock < requested.get(product.id)) { const err = new Error(`Only ${product.stock} left in stock for ${product.name}`); err.statusCode = 400; throw err; }
    item.customizationCharge = customizationCharge(product, Boolean(item.customization));
    const unitPaise = Math.round((product.price + item.customizationCharge) * 100);
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
  return { orderItemsData, pricing, cartItemIds, cartSnapshot };
}

/** Reserves stock and writes the order. `payment` adds fields to the Payment row (status, Razorpay IDs). */
async function commitOrder(tx, userId, { orderNumber, shippingAddress, notes }, prepared, normalizedPaymentMethod, payment = {}) {
  const { orderItemsData, pricing, cartItemIds } = prepared;
  for (const item of orderItemsData) {
    const updated = await tx.product.updateMany({ where: { id: item.productId, isActive: true, price: item.catalogPrice, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
    if (!updated.count) { const err = new Error('Product not found or insufficient stock'); err.statusCode = 400; throw err; }
  }

  const newOrder = await tx.order.create({
    data: {
      userId,
      orderNumber,
      totalAmount: pricing.totalAmount,
      pricing,
      shippingAddress: shippingAddress || {},
      notes,
      payment: { create: { method: normalizedPaymentMethod, amount: pricing.totalAmount, currency: 'INR', ...payment } },
      items: {
        create: orderItemsData.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          image: item.image,
          ...(item.customization ? {
            customization: item.customization,
            customizationId: item.customizationId || null,
            customizationCharge: item.customizationCharge,
            customizationStatus: 'PENDING_REVIEW',
            customizationStatusAt: new Date(),
          } : {}),
        })),
      },
    },
    include: { items: true },
  });

  const orderedDesignIds = orderItemsData.filter((item) => item.customization && item.customizationId).map((item) => item.customizationId);
  if (orderedDesignIds.length) {
    await tx.customizationDesign.updateMany({ where: { id: { in: orderedDesignIds }, userId }, data: { status: 'ORDERED' } });
  }

  if (cartItemIds) {
    const deleted = await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds }, cart: { userId } } });
    if (deleted.count !== cartItemIds.length) { const err = new Error('Cart changed during checkout'); err.statusCode = 409; throw err; }
  }

  return newOrder;
}

const DELIVERED = 'DELIVERED';
const deliveredLockedError = () => {
  const err = new Error('This order has been delivered. Its status can no longer be changed.');
  err.statusCode = HTTP_STATUS.CONFLICT;
  return err;
};

const onlinePaymentError = () => {
  const err = new Error('Online payments are placed through the payment gateway, not the orders API');
  err.statusCode = 400;
  return err;
};

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

  /** Cash on Delivery: the order is created immediately. */
  createFromCart: async (userId, input) => {
    const normalizedPaymentMethod = String(input.paymentMethod ?? 'COD').toUpperCase();
    if (normalizedPaymentMethod !== 'COD') throw onlinePaymentError();
    const expected = input.expectedTotal ?? input.totalAmount;
    if (!Number.isFinite(expected) || expected < 0) { const err = new Error('Expected total is required'); err.statusCode = 400; throw err; }
    return prisma.$transaction(async (tx) => {
      const prepared = await prepareOrder(tx, userId, input);
      return commitOrder(tx, userId, input, prepared, normalizedPaymentMethod);
    });
  },

  /** Online payment, step 1: price the checkout without creating an order or touching stock. */
  quoteOrder: async (userId, input) => prisma.$transaction(async (tx) => {
    const { pricing, cartSnapshot } = await prepareOrder(tx, userId, input);
    return { pricing, cartSnapshot };
  }),

  /**
   * Online payment, step 2: called inside the caller's transaction once the payment is captured.
   * Re-validates price, stock and (for cart checkouts) that the cart is unchanged since step 1.
   */
  createPaidOrder: async (tx, userId, input, { cartSnapshot, razorpayOrderId, razorpayPaymentId }) => {
    const prepared = await prepareOrder(tx, userId, input);
    if ((prepared.cartSnapshot || null) !== (cartSnapshot || null)) {
      const err = new Error('Cart changed after payment started'); err.statusCode = 409; throw err;
    }
    return commitOrder(tx, userId, input, prepared, 'RAZORPAY', { status: 'SUCCEEDED', razorpayOrderId, razorpayPaymentId });
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
    if (order.status === normalizedStatus) return order;
    // Delivered is final. The condition is part of the UPDATE, so two admins racing cannot reopen it.
    const updated = await prisma.order.updateMany({
      where: { id: order.id, status: { not: DELIVERED } },
      data: { status: normalizedStatus },
    });
    if (!updated.count) throw deliveredLockedError();
    return orderRepository.findById(order.id);
  },
};
