import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Provision the schema separately with `prisma migrate deploy`; never point this at public.
test('isolated PostgreSQL customized and ordinary ordering', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/);
  process.env.DATABASE_URL = database.toString();
  process.env.NODE_ENV = 'test';
  process.env.RAZORPAY_KEY_ID = 'integration_dummy_key';
  process.env.RAZORPAY_KEY_SECRET = 'integration_dummy_secret';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-order-it-'));
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
    const users = await Promise.all([0, 1].map((i) => prisma.user.create({ data: {
      name: `Ordering test ${i}`, email: `ordering-${suffix}-${i}@example.invalid`, password: 'not-a-login-password',
    } })));
    // Public catalog is read only; all stock changes are on the isolated copy.
    let source;
    try {
      [source] = await prisma.$queryRaw`SELECT name, description, price, images FROM public.products WHERE "isActive" = true AND price > 0 LIMIT 1`;
    } catch {
      // The isolated database may not contain an accessible public catalog.
    }
    const category = await prisma.category.create({ data: { name: 'Integration', slug: `ordering-${suffix}` } });
    const product = await prisma.product.create({ data: {
      name: source?.name || 'Integration product', description: source?.description || 'Test product',
      price: source?.price || 10, images: source?.images || [], stock: 100,
      slug: `ordering-${suffix}`, categoryId: category.id,
    } });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const tokens = users.map((user) => signToken({ id: user.id }));
    const request = (url, user, options = {}) => fetch(base + url, { ...options, headers: { ...(user == null ? {} : { Authorization: `Bearer ${tokens[user]}` }), ...options.headers } });
    const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const send = async (url, user, method, body, status) => {
      const response = await request(url, user, json(method, body));
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify(result));
      return result.data;
    };
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([image], { type: 'image/png' }), 'art.png');
    const upload = await request('/customizations/assets', 0, { method: 'POST', body: form });
    assert.equal(upload.status, 201);
    const assetId = (await upload.json()).data.id;
    assert.equal((await request(`/customizations/assets/${assetId}`, 1)).status, 404);
    assert.equal((await request(`/customizations/assets/${assetId}`, null)).status, 401);
    const { calculateOrderPricing } = await import('../src/services/orderPricing.js');
    const background = { x: 50, y: 50, width: 60, height: 60, shape: 'rect', color: null, opacity: 1, imageAssetId: null, pattern: null, patternColor: '#000000', borderStyle: 'none', borderWidth: 0, borderColor: '#000000' };
    const logo = (id) => ({ id, type: 'logo', assetId, keepAspect: true, x: 50, y: 50, width: 30, height: 30, rotation: 0, opacity: 1 });
    const payload = (name) => ({ name, quantity: 1, options: {}, instructions: {}, design: { version: 2, productImage: product.images[0] || null, elements: [logo(name)], background } });
    const finalize = async (design) => {
      const preview = new FormData();
      preview.append('expectedRevision', String(design.revision));
      preview.append('preview', new Blob([image], { type: 'image/png' }), 'preview.png');
      const response = await request(`/customizations/designs/${design.id}/finalize`, 0, { method: 'POST', body: preview });
      assert.equal(response.status, 200);
      return (await response.json()).data;
    };
    await send('/customizations/designs', 1, 'POST', { productId: product.id, ...payload('First') }, 400);
    const first = await finalize(await send('/customizations/designs', 0, 'POST', { productId: product.id, ...payload('First') }, 201));
    const second = await finalize(await send('/customizations/designs', 0, 'POST', { productId: product.id, ...payload('Second') }, 201));
    await send('/cart', 0, 'POST', { productId: product.id, quantity: 1, customizationId: first.id }, 200);
    await send('/cart', 0, 'POST', { productId: product.id, quantity: 1, customizationId: second.id }, 200);
    const cart = (await (await request('/cart', 0)).json()).data.cart;
    assert.equal(cart.items.length, 2);
    assert.notEqual(cart.items[0].id, cart.items[1].id);
    assert.deepEqual(cart.items.map((item) => item.customization.name).sort(), ['First', 'Second']);
    const paise = Math.round(product.price * 100);
    const price = paise / 100;
    await send('/orders', 1, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1, customizationId: first.id }], expectedTotal: price }, 400);
    await send('/orders', 0, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1 }], expectedTotal: price, paymentMethod: 'RAZORPAY' }, 503);
    const direct = (await send('/orders', 0, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 2, price: 0, name: 'Spoof', customizationId: second.id }], expectedTotal: calculateOrderPricing(paise * 2).totalAmount, paymentMethod: 'COD' }, 201)).order;
    assert.equal(direct.items[0].price, price);
    assert.equal(direct.items[0].name, product.name);
    assert.equal((await (await request('/cart', 0)).json()).data.cart.items.length, 2);
    assert.equal((await request(`/orders/${direct.id}`, 1)).status, 403);
    const ordered = (await send('/orders', 0, 'POST', { shippingAddress: {}, paymentMethod: 'COD', expectedTotal: calculateOrderPricing(paise * 2).totalAmount }, 201)).order;
    assert.deepEqual(ordered.items.map((item) => item.customization.name).sort(), ['First', 'Second']);
    await send(`/customizations/designs/${second.id}`, 0, 'PUT', { expectedRevision: (await prisma.customizationDesign.findUniqueOrThrow({ where: { id: second.id } })).revision, ...payload('Later') }, 200);
    assert.equal((await (await request(`/customizations/designs/${second.id}`, 0)).json()).data.name, 'Later');
    const persisted = await prisma.orderItem.findMany({ where: { orderId: ordered.id } });
    assert.deepEqual(persisted.map((item) => item.customization.name).sort(), ['First', 'Second']);
    assert.equal((await prisma.orderItem.findFirstOrThrow({ where: { orderId: direct.id } })).customization.name, 'Second');
    assert.equal((await (await request('/cart', 0)).json()).data.cart.items.length, 0);
    const ordinary = (await send('/orders', 0, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'COD', expectedTotal: calculateOrderPricing(paise).totalAmount }, 201)).order;
    assert.equal(ordinary.items[0].price, price);
    assert.equal(ordinary.items[0].customization, null);
    assert.equal(ordinary.items[0].customizationStatus, null);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
