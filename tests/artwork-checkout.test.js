import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-artwork-'));
process.env.PRIVATE_ARTWORK_DIR = directory;
const { default: prisma } = await import('../src/config/db.js');
const { storeArtwork, readArtwork } = await import('../src/services/artworkStorage.js');
const { orderService } = await import('../src/services/orderService.js');
const { calculateOrderPricing } = await import('../src/services/orderPricing.js');
const originalTransaction = prisma.$transaction;
after(async () => { prisma.$transaction = originalTransaction; await rm(directory, { recursive: true, force: true }); });

test('quota, private key, and failed metadata write cleanup', async () => {
  let count = 100;
  let key;
  const tx = { $queryRaw: async () => [], customizationAsset: {
    aggregate: async () => ({ _count: count, _sum: { size: 0 } }),
    create: async ({ data }) => { key = data.storageKey; throw new Error('database failure'); },
  } };
  prisma.$transaction = async (callback) => callback(tx);
  await assert.rejects(storeArtwork('owner', 'image/png', Buffer.from('a')), { statusCode: 413 });
  assert.deepEqual(await readdir(directory), []);
  count = 0;
  await assert.rejects(storeArtwork('owner', 'image/png', Buffer.from('a')), /database failure/);
  assert.deepEqual(await readdir(directory), []);
  assert.throws(() => readArtwork('../outside'), /Invalid artwork storage key/);
  tx.customizationAsset.create = async ({ data }) => { key = data.storageKey; return { id: 'id' }; };
  assert.deepEqual(await storeArtwork('owner', 'image/png', Buffer.from('test')), { id: 'id' });
  assert.equal((await readArtwork(key)).toString(), 'test');
});

test('buy-now leaves cart untouched; cart checkout deletes only snapshotted IDs', async () => {
  let deleted;
  let reads = 0;
  const tx = {
    $queryRaw: async () => [],
    cart: { findUnique: async () => { reads++; return { items: [{ id: 'line', productId: 'p', quantity: 1, customization: null, product: { price: 10, name: 'P', images: [] } }] }; } },
    product: { findUnique: async () => ({ price: 10, name: 'P', images: [], isActive: true }), updateMany: async () => ({ count: 1 }) },
    order: { create: async ({ data }) => data },
    cartItem: { deleteMany: async ({ where }) => { deleted = where; return { count: 1 }; } },
  };
  prisma.$transaction = async (callback) => callback(tx);
  const expectedTotal = calculateOrderPricing(1000).totalAmount;
  await orderService.createFromCart('owner', { items: [{ productId: 'p', quantity: 1, price: 10 }], shippingAddress: {}, expectedTotal });
  assert.equal(reads, 0);
  assert.equal(deleted, undefined);
  await orderService.createFromCart('owner', { shippingAddress: {}, expectedTotal });
  assert.deepEqual(deleted, { id: { in: ['line'] }, cart: { userId: 'owner' } });
  tx.cartItem.deleteMany = async () => ({ count: 0 });
  await assert.rejects(orderService.createFromCart('owner', { shippingAddress: {}, expectedTotal }), { statusCode: 409 });
});
