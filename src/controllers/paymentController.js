import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendAdminOrderNotification, sendOrderConfirmation } from '../helpers/email.js';
import { emitOrderCreated } from '../sockets/index.js';
import { orderService } from '../services/orderService.js';

/*
 * Online payment flow. No Order row exists until the money is captured:
 *   1. create-order   prices the checkout, creates a Razorpay order and a CheckoutSession (no stock change)
 *   2. verify-payment the browser reports success; we check the signature and the captured payment
 *      webhook       Razorpay reports the same thing server to server (covers closed tabs)
 *   3. finalizeCheckout, run by whichever of the two arrives first, creates the paid order
 * A failed or abandoned payment leaves only the session behind, so it never shows up as an order.
 */

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

/**
 * The Razorpay SDK rejects with a plain { statusCode, error } object. That status describes our
 * API keys or request, not the customer's session, so it must never reach the browser as-is:
 * the storefront treats any 401 as "signed out" and sends the customer to the login page.
 */
export function toGatewayError(err) {
  if (err instanceof Error || !err?.statusCode) return err;
  logger.error(`Razorpay rejected the request: ${err.statusCode} ${err.error?.code || ''} ${err.error?.description || ''}`.trim());
  const gatewayError = new Error('The payment gateway is unavailable right now. Please try again or choose Cash on Delivery.');
  gatewayError.statusCode = 502;
  return gatewayError;
}

export function validSignature(secret, orderId, paymentId, signature) {
  if (typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** Razorpay signs the exact raw request body with the webhook secret (HMAC-SHA256, hex). */
export function validWebhookSignature(secret, rawBody, signature) {
  if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

const orderWithDetails = { payment: true, items: true, user: { select: { name: true, email: true } } };

/** True when the captured payment is exactly what the session asked for. */
const paymentMatchesSession = (payment, session) => payment.order_id === session.razorpayOrderId
  && payment.status === 'captured'
  && payment.currency === session.currency
  && payment.amount === session.amount;

/** Customer and admin notifications for a newly paid order. Failures are logged, never thrown. */
async function notifyOrderPaid(order) {
  const customerName = order.user?.name || order.shippingAddress?.fullName || 'Customer';
  const customerEmail = order.user?.email || order.shippingAddress?.email || '';
  const paidOrder = { ...order, paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' };
  // Wrapped so a synchronous throw (e.g. no customer email) is a settled rejection, not a crash.
  const results = await Promise.allSettled([
    (async () => sendOrderConfirmation(paidOrder, { name: customerName, email: customerEmail }))(),
    (async () => sendAdminOrderNotification(paidOrder, { name: customerName, email: customerEmail }))(),
  ]);
  results.filter((r) => r.status === 'rejected').forEach((r) => logger.warn(`Order ${order.id} paid, but a notification failed: ${r.reason?.message}`));
  emitOrderCreated({
    id: order.id,
    orderId: order.orderNumber,
    customer: customerName,
    customerEmail,
    amount: order.totalAmount,
    totalAmount: order.totalAmount,
    itemsCount: order.items.length,
    items: order.items.map(({ customization, ...item }) => ({ ...item, isCustomized: Boolean(customization) })),
    status: order.status,
    createdAt: order.createdAt,
  });
}

/**
 * The money was captured but the order cannot be built (stock ran out, price or cart changed).
 * Refund it in full. Only the caller that moves the session out of PENDING issues the refund.
 */
async function refundSession(session, razorpayPaymentId, client, reason) {
  const claimed = await prisma.checkoutSession.updateMany({
    where: { id: session.id, status: 'PENDING' },
    data: { status: 'REFUNDING', razorpayPaymentId, failureReason: reason },
  });
  if (!claimed.count) {
    const current = await prisma.checkoutSession.findUnique({ where: { id: session.id } });
    return { refunded: current?.status === 'REFUNDED', status: current?.status, reason: current?.failureReason || reason };
  }
  logger.error(`Checkout ${session.id}: payment ${razorpayPaymentId} captured but order failed (${reason}); refunding`);
  try {
    await client.payments.refund(razorpayPaymentId, { amount: session.amount, notes: { reason: reason.slice(0, 250) } });
    await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: 'REFUNDED' } });
    return { refunded: true, status: 'REFUNDED', reason };
  } catch (err) {
    const detail = err?.error?.description || err?.message || 'unknown error';
    logger.error(`Checkout ${session.id}: REFUND FAILED for payment ${razorpayPaymentId}: ${detail}. Refund it manually in the Razorpay dashboard.`);
    await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: 'REFUND_FAILED', failureReason: `${reason}; refund failed: ${detail}` } });
    return { refunded: false, status: 'REFUND_FAILED', reason };
  }
}

/**
 * Creates the paid order for a checkout session exactly once. Safe to call from verify and the
 * webhook at the same time: the session row is locked, and the second caller gets the same order.
 * Returns { order } on success, or { refunded, status, reason } when the order could not be made.
 */
export async function finalizeCheckout(sessionId, razorpayPaymentId, client) {
  let result;
  let session;
  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "checkout_sessions" WHERE id = ${sessionId} FOR UPDATE`;
      session = await tx.checkoutSession.findUnique({ where: { id: sessionId } });
      if (!session) { const err = new Error('Checkout not found'); err.statusCode = 404; err.fatal = true; throw err; }
      if (session.status === 'PAID') {
        return { order: await tx.order.findUnique({ where: { id: session.orderId }, include: orderWithDetails }), created: false };
      }
      if (session.status !== 'PENDING') return { refunded: session.status === 'REFUNDED', status: session.status, reason: session.failureReason };

      const created = await orderService.createPaidOrder(tx, session.userId, session.input, {
        cartSnapshot: session.input.cartSnapshot || null,
        razorpayOrderId: session.razorpayOrderId,
        razorpayPaymentId,
      });
      await tx.checkoutSession.update({ where: { id: session.id }, data: { status: 'PAID', orderId: created.id, razorpayPaymentId } });
      return { order: await tx.order.findUnique({ where: { id: created.id }, include: orderWithDetails }), created: true };
    }, { timeout: 30000 });
  } catch (err) {
    // A business rule failed (4xx, or a duplicate order number): the customer paid for an order we
    // cannot fulfil, so refund. Anything else (database down, ...) is rethrown so it can be retried.
    const businessFailure = !err.fatal && session && ((err.statusCode >= 400 && err.statusCode < 500) || err.code === 'P2002');
    if (!businessFailure) throw err;
    return refundSession(session, razorpayPaymentId, client, err.message);
  }
  if (result.created) {
    logger.info(`Order ${result.order.id} created from paid checkout ${sessionId} (${razorpayPaymentId})`);
    await notifyOrderPaid(result.order);
  }
  return result;
}

const refundMessage = (result) => (result.status === 'REFUNDED'
  ? `We could not complete your order (${result.reason}). Your payment has been refunded and will reach your account in 5-7 working days.`
  : `Your payment went through, but we could not complete the order (${result.reason}). Please contact support; we will refund you.`);

export const paymentController = {
  /** Step 1. Body is the same validated checkout body as POST /orders. Creates no order. */
  createRazorpayOrder: async (req, res, next) => {
    try {
      const { client, key_id } = gateway();
      const { orderNumber, items, shippingAddress, notes, couponCode } = req.body;
      const input = { orderNumber, items, shippingAddress, notes, couponCode, expectedTotal: req.body.expectedTotal ?? req.body.totalAmount };
      const { pricing, cartSnapshot } = await orderService.quoteOrder(req.user.id, input);
      const amount = Math.round(pricing.totalAmount * 100);
      if (!Number.isSafeInteger(amount) || amount < 100) return sendError(res, 'Online payment needs an order total of at least ₹1', 400);

      const created = await client.orders.create({ amount, currency: 'INR', receipt: String(orderNumber).slice(0, 40), notes: { orderNumber } });
      if (!created?.id || created.amount !== amount || created.currency !== 'INR') throw new Error('Invalid gateway order');
      const session = await prisma.checkoutSession.create({
        data: { userId: req.user.id, razorpayOrderId: created.id, amount, currency: 'INR', input: { ...input, expectedTotal: pricing.totalAmount, cartSnapshot } },
      });
      return sendSuccess(res, { orderId: created.id, amount, currency: 'INR', keyId: key_id, checkoutId: session.id, orderNumber }, 'Razorpay order created successfully');
    } catch (err) {
      if (err.pricing) return sendError(res, err.message, 409, { code: 'PRICE_MISMATCH', pricing: err.pricing });
      next(toGatewayError(err));
    }
  },

  /** Step 2 (browser). On success the store order is created and returned. */
  verifyRazorpayPayment: async (req, res, next) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((value) => typeof value === 'string' && value.length > 0 && value.length <= 200)) {
        return sendError(res, 'Missing payment verification parameters', 400);
      }
      const { client, key_secret } = gateway();
      const session = await prisma.checkoutSession.findFirst({ where: { razorpayOrderId: razorpay_order_id, userId: req.user.id } });
      if (!session || !validSignature(key_secret, razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        return sendError(res, 'Invalid payment verification', 400);
      }

      if (session.status === 'PENDING') {
        let providerPayment = await client.payments.fetch(razorpay_payment_id);
        // Accounts with manual capture leave the payment "authorized"; capture it for the exact amount.
        if (providerPayment.status === 'authorized' && providerPayment.order_id === session.razorpayOrderId && providerPayment.amount === session.amount) {
          providerPayment = await client.payments.capture(razorpay_payment_id, session.amount, session.currency);
        }
        if (!paymentMatchesSession(providerPayment, session)) {
          return sendError(res, 'Payment has not been captured for this order', 400);
        }
      }

      const result = await finalizeCheckout(session.id, razorpay_payment_id, client);
      if (!result.order) return sendError(res, refundMessage(result), 409, { code: 'PAYMENT_REFUNDED', refundStatus: result.status });
      return sendSuccess(res, {
        verified: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        order: result.order,
        status: 'SUCCESS',
        paymentStatus: 'PAID',
        paymentMethod: 'RAZORPAY',
      }, 'Razorpay payment verified successfully');
    } catch (err) { next(toGatewayError(err)); }
  },

  /**
   * POST /api/v1/payments/razorpay/webhook (no login; mounted with a raw body parser in app.js).
   * Creates the order when the customer paid but closed the tab before the browser verify call ran.
   * Replies 2xx for anything it has handled or chosen to ignore, so Razorpay stops retrying;
   * an unexpected error becomes a 500 so Razorpay retries later.
   */
  razorpayWebhook: async (req, res) => {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not set');
      return sendError(res, 'Webhook is not configured', 503);
    }
    if (!validWebhookSignature(secret, req.body, req.get('x-razorpay-signature'))) {
      logger.warn('Razorpay webhook rejected: invalid signature');
      return sendError(res, 'Invalid webhook signature', 400);
    }

    let event;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { return sendError(res, 'Invalid webhook body', 400); }
    const eventId = req.get('x-razorpay-event-id') || '';
    let entity = event?.payload?.payment?.entity;
    logger.info(`Razorpay webhook ${event?.event} ${eventId} payment=${entity?.id || '-'} order=${entity?.order_id || '-'}`);

    if (event?.event === 'payment.failed') {
      // Checkout lets the customer retry on the same Razorpay order, and no store order exists yet.
      logger.warn(`Razorpay payment failed: ${entity?.id} order=${entity?.order_id} ${entity?.error_code || ''} ${entity?.error_description || ''}`.trim());
      return sendSuccess(res, { received: true });
    }
    if (!['payment.captured', 'payment.authorized', 'order.paid'].includes(event?.event) || !entity?.id || !entity?.order_id) {
      return sendSuccess(res, { received: true, ignored: true });
    }

    const session = await prisma.checkoutSession.findUnique({ where: { razorpayOrderId: entity.order_id } });
    if (!session) {
      logger.warn(`Razorpay webhook for unknown order ${entity.order_id}; ignoring`);
      return sendSuccess(res, { received: true, ignored: true });
    }
    if (session.status !== 'PENDING') return sendSuccess(res, { received: true, status: session.status });

    const { client } = gateway();
    if (entity.status === 'authorized' && entity.amount === session.amount) {
      entity = await client.payments.capture(entity.id, session.amount, session.currency);
    }
    if (!paymentMatchesSession(entity, session)) {
      logger.error(`Razorpay webhook payment mismatch for checkout ${session.id}: got ${entity.status} ${entity.amount} ${entity.currency}, expected captured ${session.amount} ${session.currency}`);
      return sendSuccess(res, { received: true, ignored: true });
    }

    const result = await finalizeCheckout(session.id, entity.id, client);
    return sendSuccess(res, { received: true, orderCreated: Boolean(result.order), status: result.status || 'PAID' });
  },
};
