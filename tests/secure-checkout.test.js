import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../src/config/db.js';
import { orderService } from '../src/services/orderService.js';
import { toGatewayError, validSignature, validWebhookSignature, paymentController, finalizeCheckout } from '../src/controllers/paymentController.js';
import { createOrderSchema } from '../src/validations/orderValidation.js';
import { calculateOrderPricing } from '../src/services/orderPricing.js';

const transaction = prisma.$transaction;
after(() => { prisma.$transaction = transaction; });

test('direct orders use catalog details, not client price or total', async () => {
  const tx = {
    $queryRaw: async () => [],
    product: { findUnique: async () => ({ price: 12.34, name: 'Real', images: ['real'], isActive: true }), updateMany: async () => ({ count: 1 }) },
    order: { create: async ({ data }) => data },
  };
  prisma.$transaction = async (callback) => callback(tx);
  const expectedTotal = calculateOrderPricing(2468).totalAmount;
  const order = await orderService.createFromCart('u', { items: [{ productId: 'p', quantity: 2, price: 0, name: 'Fake' }], totalAmount: 0, expectedTotal, shippingAddress: {}, paymentMethod: 'COD' });
  assert.equal(order.totalAmount, expectedTotal);
  assert.equal(order.items.create[0].price, 12.34);
  assert.equal(order.items.create[0].name, 'Real');
  assert.equal(order.payment.create.method, 'COD');
  tx.product.updateMany = async () => ({ count: 0 });
  await assert.rejects(orderService.createFromCart('u', { items: [{ productId: 'p', quantity: 2 }], shippingAddress: {}, expectedTotal }), /insufficient stock/);
});

test('order validation rejects invalid quantities and payment methods', () => {
  assert.equal(createOrderSchema.safeParse({ shippingAddress: {}, totalAmount: 1, items: [{ productId: 'p', quantity: -1 }] }).success, false);
  assert.equal(createOrderSchema.safeParse({ shippingAddress: {}, totalAmount: 1, paymentMethod: 'fake' }).success, false);
});

test('pricing applies settings aliases, discounts, shipping and tax in paise', () => {
  const settings = { freeShippingMinimum: 999, deliveryCharge: 99, taxRate: 18 };
  const coupon = () => ({ code: 'SAVE', discountType: 'percent', discountValue: 10 });
  assert.deepEqual(calculateOrderPricing(10000, 'SAVE', settings, coupon), { subtotal: 100, discountAmount: 10, shippingFee: 99, taxPercentage: 18, taxAmount: 16.2, totalAmount: 205.2, couponCode: 'SAVE' });
  assert.equal(calculateOrderPricing(100000, null, settings).shippingFee, 0);
  assert.equal(calculateOrderPricing(10000, 'SAVE', settings, () => ({ code: 'SAVE', discountType: 'fixed', discountValue: 200 })).discountAmount, 100);
  assert.throws(() => calculateOrderPricing(10000, 'BAD', settings, () => { throw new Error('invalid coupon'); }), /invalid coupon/);
});

test('mismatch and disabled online payment cause no mutations', async () => {
  let writes = 0;
  prisma.$transaction = async (callback) => callback({
    $queryRaw: async () => [],
    product: { findUnique: async () => ({ price: 10, name: 'P', images: [], isActive: true }), updateMany: async () => { writes++; } },
    order: { create: async () => { writes++; } },
  });
  // Online orders are only created by the payment flow after the money is captured.
  await assert.rejects(orderService.createFromCart('u', { paymentMethod: 'RAZORPAY', expectedTotal: 1 }), { statusCode: 400 });
  await assert.rejects(orderService.createFromCart('u', { items: [{ productId: 'p', quantity: 1 }], expectedTotal: 1 }), (error) => error.statusCode === 409 && error.pricing.totalAmount !== 1);
  assert.equal(writes, 0);
});

test('buy-now customization is rebuilt from a saved, owned design', async () => {
  const saved = { id: 'd1', userId: 'u', productId: 'p', name: 'Mine', status: 'SAVED', previewAssetId: 'preview', assetIds: [], design: { version: 2, elements: [] } };
  let row = saved;
  let owned = 1;
  let created;
  prisma.$transaction = async (callback) => callback({
    $queryRaw: async () => [],
    customizationAsset: { count: async () => owned, findMany: async () => [] },
    customizationDesign: { findFirst: async ({ where }) => (row && where.userId === row.userId && where.id === row.id ? row : null), updateMany: async () => ({ count: 1 }) },
    product: { findUnique: async () => ({ price: 10, name: 'P', images: [], isActive: true, customizationConfig: { chargePerUnit: 2 } }), updateMany: async () => ({ count: 1 }) },
    order: { create: async ({ data }) => { created = data; return data; } },
  });
  const input = { items: [{ productId: 'p', quantity: 1, customizationId: 'd1', customization: { name: 'tampered' } }], expectedTotal: calculateOrderPricing(1200).totalAmount };
  await orderService.createFromCart('u', input);
  const line = created.items.create[0];
  assert.equal(line.customization.name, 'Mine');
  assert.equal(line.customizationId, 'd1');
  assert.equal(line.customizationCharge, 2);
  assert.equal(line.customizationStatus, 'PENDING_REVIEW');
  assert.equal(line.price, 12);
  row = { ...saved, status: 'DRAFT' };
  await assert.rejects(orderService.createFromCart('u', input), /Save the current customization/);
  row = { ...saved, productId: 'other' };
  await assert.rejects(orderService.createFromCart('u', input), /different product/);
  row = { ...saved, userId: 'someone-else' };
  await assert.rejects(orderService.createFromCart('u', input), /Customization not found/);
  row = saved; owned = 0;
  await assert.rejects(orderService.createFromCart('u', input), /asset not found/);
  owned = 1;
  await assert.rejects(orderService.createFromCart('u', { items: [{ productId: 'p', quantity: 1, customization: { previewAssetId: 'preview' } }], expectedTotal: 1 }), /Save the current customization/);
});

test('a Razorpay rejection never reaches the browser as a sign-in failure', () => {
  const rejectedKeys = toGatewayError({ statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } });
  assert.ok(rejectedKeys instanceof Error);
  assert.equal(rejectedKeys.statusCode, 502);
  assert.match(rejectedKeys.message, /payment gateway is unavailable/i);
  assert.doesNotMatch(rejectedKeys.message, /Authentication failed/);
  assert.equal(toGatewayError({ statusCode: 400, error: { code: 'BAD_REQUEST_ERROR' } }).statusCode, 502);

  const appError = Object.assign(new Error('Order is not eligible for payment'), { statusCode: 400 });
  assert.equal(toGatewayError(appError), appError, 'our own errors keep their status');
  const expiredLogin = Object.assign(new Error('Token expired'), { statusCode: 401 });
  assert.equal(toGatewayError(expiredLogin).statusCode, 401);
});

test('signature verification requires an exact HMAC and binding', () => {
  const signature = crypto.createHmac('sha256', 'secret').update('order|payment').digest('hex');
  assert.equal(validSignature('secret', 'order', 'payment', signature), true);
  assert.equal(validSignature('secret', 'other', 'payment', signature), false);
  assert.equal(validSignature('secret', 'order', 'payment', ''), false);
  assert.equal(validSignature('secret', 'order', 'payment', 'order_mock_123'), false);
});

test('webhook signature is an HMAC of the exact raw body', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const signature = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  assert.equal(validWebhookSignature('whsec', body, signature), true);
  assert.equal(validWebhookSignature('other', body, signature), false);
  assert.equal(validWebhookSignature('whsec', Buffer.from('{"event":"payment.captured" }'), signature), false);
  assert.equal(validWebhookSignature('whsec', body, ''), false);
  assert.equal(validWebhookSignature('', body, signature), false);
});

const pendingSession = () => ({ id: 'cs1', userId: 'u1', razorpayOrderId: 'order_X', amount: 153282, currency: 'INR', status: 'PENDING', input: { orderNumber: 'ORD-2026-1', expectedTotal: 1532.82, cartSnapshot: 'ci1:1' } });

/** Replaces prisma / orderService members for one test and restores them afterwards. */
async function withStubs(stubs, run) {
  const saved = stubs.map(([target, key]) => [target, key, target[key]]);
  stubs.forEach(([target, key, value]) => { target[key] = value; });
  try { return await run(); } finally { saved.forEach(([target, key, value]) => { target[key] = value; }); }
}

/** An in-memory checkout_sessions row plus the transaction client finalizeCheckout uses. */
function sessionStore(session) {
  const store = { session, orders: [] };
  const sessionApi = {
    findUnique: async () => store.session && { ...store.session },
    update: async ({ data }) => { Object.assign(store.session, data); return store.session; },
    updateMany: async ({ where, data }) => {
      if (store.session.status !== where.status) return { count: 0 };
      Object.assign(store.session, data); return { count: 1 };
    },
  };
  const tx = {
    $queryRaw: async () => [],
    checkoutSession: sessionApi,
    order: { findUnique: async ({ where }) => store.orders.find((o) => o.id === where.id) || null },
  };
  store.stubs = [
    [prisma, '$transaction', async (callback) => callback(tx)],
    [prisma.checkoutSession, 'findUnique', sessionApi.findUnique],
    [prisma.checkoutSession, 'update', sessionApi.update],
    [prisma.checkoutSession, 'updateMany', sessionApi.updateMany],
  ];
  return store;
}

const paidOrder = (id) => ({ id, orderNumber: 'ORD-2026-1', totalAmount: 1532.82, status: 'PENDING', items: [], user: { name: 'A', email: '' }, shippingAddress: {} });

test('a captured payment creates exactly one order; a second call returns the same order', async () => {
  const store = sessionStore(pendingSession());
  let created = 0;
  const createPaidOrder = async (tx, userId, input, payment) => {
    created += 1;
    assert.equal(userId, 'u1');
    assert.equal(payment.razorpayPaymentId, 'pay_Y');
    assert.equal(payment.cartSnapshot, 'ci1:1');
    const order = paidOrder(`o${created}`);
    store.orders.push(order);
    return order;
  };
  await withStubs([...store.stubs, [orderService, 'createPaidOrder', createPaidOrder]], async () => {
    const first = await finalizeCheckout('cs1', 'pay_Y', {});
    assert.equal(first.order.id, 'o1');
    assert.equal(store.session.status, 'PAID');
    assert.equal(store.session.orderId, 'o1');
    const again = await finalizeCheckout('cs1', 'pay_Y', {});
    assert.equal(again.order.id, 'o1');
    assert.equal(created, 1, 'verify + webhook must not create two orders');
  });
});

test('if the order cannot be built after payment, the customer is refunded and no order exists', async () => {
  const store = sessionStore(pendingSession());
  const refunds = [];
  const client = { payments: { refund: async (paymentId, body) => { refunds.push([paymentId, body.amount]); return { id: 'rfnd_1' }; } } };
  const outOfStock = async () => { const err = new Error('Product not found or insufficient stock'); err.statusCode = 400; throw err; };
  await withStubs([...store.stubs, [orderService, 'createPaidOrder', outOfStock]], async () => {
    const result = await finalizeCheckout('cs1', 'pay_Y', client);
    assert.equal(result.order, undefined);
    assert.equal(result.status, 'REFUNDED');
    assert.deepEqual(refunds, [['pay_Y', 153282]]);
    assert.equal(store.orders.length, 0);
    await finalizeCheckout('cs1', 'pay_Y', client);
    assert.equal(refunds.length, 1, 'a payment is refunded once');
  });
});

test('a database outage is retried, not refunded', async () => {
  const store = sessionStore(pendingSession());
  const client = { payments: { refund: async () => assert.fail('must not refund') } };
  const dbDown = async () => { throw new Error('Connection refused'); };
  await withStubs([...store.stubs, [orderService, 'createPaidOrder', dbDown]], async () => {
    await assert.rejects(finalizeCheckout('cs1', 'pay_Y', client), /Connection refused/);
    assert.equal(store.session.status, 'PENDING');
  });
});

test('webhook: bad signature, wrong amount and failed payments create no order', async () => {
  const store = sessionStore(pendingSession());
  let created = 0;
  const createPaidOrder = async () => { created += 1; const o = paidOrder('o1'); store.orders.push(o); return o; };
  const env = { RAZORPAY_WEBHOOK_SECRET: 'whsec', RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'secret_x' };
  const savedEnv = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  const send = async (event, entity, secret = 'whsec') => {
    const body = Buffer.from(JSON.stringify({ event, payload: { payment: { entity } } }));
    const req = { body, get: (h) => ({ 'x-razorpay-signature': crypto.createHmac('sha256', secret).update(body).digest('hex') })[h.toLowerCase()] };
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await paymentController.razorpayWebhook(req, res);
    return res;
  };
  try {
    await withStubs([...store.stubs, [orderService, 'createPaidOrder', createPaidOrder]], async () => {
      const good = { id: 'pay_Y', order_id: 'order_X', status: 'captured', currency: 'INR', amount: 153282 };
      assert.equal((await send('payment.captured', good, 'wrong')).code, 400);
      assert.equal((await send('payment.failed', { ...good, status: 'failed' })).code, 200);
      assert.equal((await send('payment.captured', { ...good, amount: 100 })).code, 200);
      assert.equal(created, 0, 'no order for a bad signature, a failure or a wrong amount');
      const ok = await send('payment.captured', good);
      assert.equal(ok.code, 200);
      assert.equal(ok.body.data.orderCreated, true);
      assert.equal(created, 1);
    });
  } finally {
    Object.entries(savedEnv).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  }
});

test('a delivered order status is final', async () => {
  const orders = { o1: { id: 'o1', status: 'SHIPPED' } };
  const saved = { findUnique: prisma.order.findUnique, updateMany: prisma.order.updateMany };
  prisma.order.findUnique = async ({ where }) => (orders[where.id] ? { ...orders[where.id] } : null);
  prisma.order.updateMany = async ({ where, data }) => {
    const row = orders[where.id];
    if (!row || row.status === where.status.not) return { count: 0 };
    row.status = data.status; return { count: 1 };
  };
  try {
    assert.equal((await orderService.updateStatus('o1', 'delivered')).status, 'DELIVERED');
    await assert.rejects(orderService.updateStatus('o1', 'PROCESSING'), { statusCode: 409, message: /delivered/i });
    await assert.rejects(orderService.updateStatus('o1', 'CANCELLED'), { statusCode: 409 });
    assert.equal(orders.o1.status, 'DELIVERED');
    assert.equal((await orderService.updateStatus('o1', 'DELIVERED')).status, 'DELIVERED', 're-saving Delivered is a no-op');
  } finally {
    Object.assign(prisma.order, saved);
  }
});
