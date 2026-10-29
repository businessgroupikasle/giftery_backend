import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../src/config/db.js';
import { orderService } from '../src/services/orderService.js';
import { validSignature } from '../src/controllers/paymentController.js';
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
  await assert.rejects(orderService.createFromCart('u', { paymentMethod: 'RAZORPAY', expectedTotal: 1 }), { statusCode: 503 });
  await assert.rejects(orderService.createFromCart('u', { items: [{ productId: 'p', quantity: 1 }], expectedTotal: 1 }), (error) => error.statusCode === 409 && error.pricing.totalAmount !== 1);
  assert.equal(writes, 0);
});

test('buy-now customization must match saved draft with owned preview', async () => {
  const design = { version: 1, previewAssetId: 'preview' };
  let draft = { design };
  let owned = 1;
  prisma.$transaction = async (callback) => callback({
    $queryRaw: async () => [], customizationAsset: { count: async () => owned }, customizationDraft: { findUnique: async () => draft },
    product: { findUnique: async () => ({ price: 10, name: 'P', images: [], isActive: true }), updateMany: async () => ({ count: 1 }) },
    order: { create: async ({ data }) => data },
  });
  const input = { items: [{ productId: 'p', quantity: 1, customization: design }], expectedTotal: calculateOrderPricing(1000).totalAmount };
  await orderService.createFromCart('u', input);
  draft = { design: { ...design, other: true } };
  await assert.rejects(orderService.createFromCart('u', input), /Save the current customization/);
  draft = { design }; owned = 0;
  await assert.rejects(orderService.createFromCart('u', input), /asset not found/);
  input.items[0].customization = { version: 1 };
  await assert.rejects(orderService.createFromCart('u', input), /Save the current customization/);
});

test('signature verification requires an exact HMAC and binding', () => {
  const signature = crypto.createHmac('sha256', 'secret').update('order|payment').digest('hex');
  assert.equal(validSignature('secret', 'order', 'payment', signature), true);
  assert.equal(validSignature('secret', 'other', 'payment', signature), false);
  assert.equal(validSignature('secret', 'order', 'payment', ''), false);
  assert.equal(validSignature('secret', 'order', 'payment', 'order_mock_123'), false);
});
