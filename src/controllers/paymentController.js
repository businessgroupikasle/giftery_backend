import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { env } from '../config/env.js';
import { sendSuccess, sendError } from '../utils/response.js';

const gateway = () => {
  const key_id = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const key_secret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    const error = new Error('Payment gateway is not configured');
    error.statusCode = 503;
    throw error;
  }
  return { client: new Razorpay({ key_id, key_secret }), key_id, key_secret };
};

export function validSignature(secret, orderId, paymentId, signature) {
  if (typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export const paymentController = {
  createRazorpayOrder: async (req, res, next) => {
    try {
      const { orderId } = req.body;
      if (typeof orderId !== 'string' || !orderId) return sendError(res, 'Store order ID is required', 400);
      const { client, key_id } = gateway();
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
        const order = await tx.order.findFirst({ where: { id: orderId, userId: req.user.id }, include: { payment: true } });
        if (!order || !order.payment || order.payment.method !== 'RAZORPAY' || order.status !== 'PENDING' || order.payment.status !== 'PENDING') {
          const error = new Error('Order is not eligible for payment'); error.statusCode = 400; throw error;
        }
        const amount = Math.round(order.totalAmount * 100);
        if (!Number.isSafeInteger(amount) || amount < 100 || order.payment.amount !== order.totalAmount || order.payment.currency !== 'INR') {
          const error = new Error('Invalid order amount'); error.statusCode = 400; throw error;
        }
        let gatewayOrderId = order.payment.razorpayOrderId;
        if (!gatewayOrderId) {
          const created = await client.orders.create({ amount, currency: 'INR', receipt: order.id });
          if (!created.id || created.amount !== amount || created.currency !== 'INR') throw new Error('Invalid gateway order');
          gatewayOrderId = created.id;
          await tx.payment.update({ where: { id: order.payment.id }, data: { razorpayOrderId: gatewayOrderId } });
        }
        return { orderId: gatewayOrderId, amount, currency: 'INR', keyId: key_id };
      }, { timeout: 30000 });
      return sendSuccess(res, result, 'Razorpay order created successfully');
    } catch (err) { next(err); }
  },

  verifyRazorpayPayment: async (req, res, next) => {
    try {
      const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      if (![orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature].every((value) => typeof value === 'string' && value.length > 0 && value.length <= 200)) {
        return sendError(res, 'Missing payment verification parameters', 400);
      }
      const { client, key_secret } = gateway();
      const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.user.id }, include: { payment: true } });
      const payment = order?.payment;
      if (!payment || payment.method !== 'RAZORPAY' || payment.razorpayOrderId !== razorpay_order_id || !validSignature(key_secret, razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        return sendError(res, 'Invalid payment verification', 400);
      }
      if (payment.status === 'SUCCEEDED' && payment.razorpayPaymentId === razorpay_payment_id) {
        return sendSuccess(res, { verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id, status: 'SUCCESS' });
      }
      if (payment.status !== 'PENDING' || order.status !== 'PENDING') return sendError(res, 'Order is not eligible for payment', 400);
      const providerPayment = await client.payments.fetch(razorpay_payment_id);
      if (providerPayment.order_id !== razorpay_order_id || providerPayment.status !== 'captured' || providerPayment.currency !== 'INR' || providerPayment.amount !== Math.round(order.totalAmount * 100) || payment.amount !== order.totalAmount) {
        return sendError(res, 'Payment has not been captured for this order', 400);
      }
      const updated = await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING', razorpayOrderId: razorpay_order_id, order: { status: 'PENDING' } }, data: { status: 'SUCCEEDED', razorpayPaymentId: razorpay_payment_id } });
      if (!updated.count) return sendError(res, 'Payment state changed; retry verification', 409);
      return sendSuccess(res, { verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id, status: 'SUCCESS' }, 'Razorpay payment verified successfully');
    } catch (err) { next(err); }
  },
};
