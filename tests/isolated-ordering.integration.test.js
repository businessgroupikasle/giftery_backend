import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Provision the schema separately with Prisma db push; never point this at public.
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
    const first = { version: 1, imageAssetId: assetId, previewAssetId: assetId, text: { value: 'First' } };
    const second = { version: 1, imageAssetId: assetId, previewAssetId: assetId, text: { value: 'Second' } };
    await send(`/customizations/drafts/${product.id}`, 1, 'PUT', { design: first }, 400);
    await send(`/customizations/drafts/${product.id}`, 0, 'PUT', { design: first }, 200);
    await send('/cart', 0, 'POST', { productId: product.id, quantity: 1, customization: first }, 200);
    await send(`/customizations/drafts/${product.id}`, 0, 'PUT', { design: second }, 200);
    await send('/cart', 0, 'POST', { productId: product.id, quantity: 1, customization: second }, 200);
    const cart = (await (await request('/cart', 0)).json()).data.cart;
    assert.equal(cart.items.length, 2);
    assert.notEqual(cart.items[0].id, cart.items[1].id);
    assert.deepEqual(cart.items.map((item) => item.customization.text.value).sort(), ['First', 'Second']);
    await send('/orders', 1, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1, customization: first }] }, 400);
    const direct = (await send('/orders', 0, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 2, price: 0, name: 'Spoof', customization: second }], totalAmount: 0, paymentMethod: 'RAZORPAY' }, 201)).order;
    const price = Math.round(product.price * 100) / 100;
    assert.equal(direct.totalAmount, price * 2);
    assert.equal(direct.items[0].price, price);
    assert.equal(direct.items[0].name, product.name);
    assert.equal((await (await request('/cart', 0)).json()).data.cart.items.length, 2);
    assert.equal((await request(`/orders/${direct.id}`, 1)).status, 403);
    await prisma.payment.update({ where: { orderId: direct.id }, data: { razorpayOrderId: `order_fake_${suffix}` } });
    await send('/payments/razorpay/verify-payment', 0, 'POST', { orderId: direct.id, razorpay_order_id: `order_fake_${suffix}`, razorpay_payment_id: 'pay_fake', razorpay_signature: 'a'.repeat(64) }, 400);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { orderId: direct.id } })).status, 'PENDING');
    const ordered = (await send('/orders', 0, 'POST', { shippingAddress: {}, paymentMethod: 'COD' }, 201)).order;
    assert.deepEqual(ordered.items.map((item) => item.customization.text.value).sort(), ['First', 'Second']);
    await send(`/customizations/drafts/${product.id}`, 0, 'PUT', { design: { ...second, text: { value: 'Later' } } }, 200);
    assert.deepEqual((await (await request(`/customizations/drafts/${product.id}`, 0)).json()).data.design.text.value, 'Later');
    const persisted = await prisma.orderItem.findMany({ where: { orderId: ordered.id } });
    assert.deepEqual(persisted.map((item) => item.customization.text.value).sort(), ['First', 'Second']);
    assert.equal((await prisma.orderItem.findFirstOrThrow({ where: { orderId: direct.id } })).customization.text.value, 'Second');
    assert.equal((await (await request('/cart', 0)).json()).data.cart.items.length, 0);
    const ordinary = (await send('/orders', 0, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'COD' }, 201)).order;
    assert.equal(ordinary.totalAmount, price);
    assert.equal(ordinary.items[0].customization, null);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
