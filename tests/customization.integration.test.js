import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('real PostgreSQL customization ownership, cart, order and staff access', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/, 'TEST_DATABASE_URL must use an isolated kilo_it_ schema');
  process.env.DATABASE_URL = database.toString();
  process.env.NODE_ENV = 'test';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-integration-'));
  process.env.PRIVATE_ARTWORK_DIR = path.join(directory, 'artwork');
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  process.env.LOG_DIR = path.join(directory, 'logs');
  const { default: prisma } = await import('../src/config/db.js');
  let server;
  try {
    const { default: app } = await import('../src/app.js');
    const { signToken } = await import('../src/utils/jwt.js');
    const sharp = (await import('sharp')).default;
    const suffix = randomUUID();
    const users = await Promise.all(['USER', 'USER', 'ADMIN'].map((role, i) => prisma.user.create({ data: {
      name: `Integration ${i}`, email: `integration-${suffix}-${i}@example.invalid`, password: 'not-a-login-password', role,
    } })));
    const category = await prisma.category.create({ data: { name: 'Integration', slug: `integration-${suffix}` } });
    const product = await prisma.product.create({ data: { name: 'Integration product', slug: `integration-${suffix}`, description: 'Test', price: 10, stock: 10, images: [], categoryId: category.id } });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const tokens = users.map((user) => signToken({ id: user.id }));
    const request = (url, user, options = {}) => fetch(base + url, { ...options, headers: { ...(user == null ? {} : { Authorization: `Bearer ${tokens[user]}` }), ...options.headers } });
    const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([image], { type: 'image/png' }), 'art.png');
    assert.equal((await request('/customizations/drafts/' + product.id, null)).status, 401);
    const uploaded = await request('/customizations/assets', 0, { method: 'POST', body: form });
    assert.equal(uploaded.status, 201);
    const assetId = (await uploaded.json()).data.id;
    assert.deepEqual(Buffer.from(await (await request(`/customizations/assets/${assetId}`, 0)).arrayBuffer()), image);
    assert.equal((await request(`/customizations/assets/${assetId}`, 1)).status, 404);
    assert.equal((await request(`/customizations/assets/${assetId}`, 2)).status, 404);
    const design = { version: 1, imageAssetId: assetId, previewAssetId: assetId, text: { value: 'Integration design' } };
    assert.equal((await request(`/customizations/drafts/${product.id}`, 1, json('PUT', { design }))).status, 400);
    assert.equal((await request(`/customizations/drafts/${product.id}`, 0, json('PUT', { design }))).status, 200);
    assert.deepEqual((await (await request(`/customizations/drafts/${product.id}`, 0)).json()).data.design, design);
    assert.equal((await (await request(`/customizations/drafts/${product.id}`, 1)).json()).data, null);
    assert.equal((await request('/cart', 0, json('POST', { productId: product.id, quantity: 1, customization: { ...design, text: { value: 'Unsaved' } } }))).status, 400);
    const added = await request('/cart', 0, json('POST', { productId: product.id, quantity: 2, customization: design }));
    assert.equal(added.status, 200);
    assert.deepEqual((await added.json()).data.cart.items[0].customization, design);
    const placed = await request('/orders', 0, json('POST', { shippingAddress: {} }));
    assert.equal(placed.status, 201);
    const order = (await placed.json()).data.order;
    assert.deepEqual(order.items[0].customization, design);
    assert.deepEqual((await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).customization, design);
    assert.equal((await (await request('/cart', 0)).json()).data.cart.items.length, 0);
    assert.equal((await request(`/orders/${order.id}`, 1)).status, 403);
    assert.equal((await request(`/orders/${order.id}`, 2)).status, 200);
    assert.deepEqual(Buffer.from(await (await request(`/customizations/assets/${assetId}`, 2)).arrayBuffer()), image);
    assert.equal((await prisma.payment.count({ where: { orderId: order.id } })), 0);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
