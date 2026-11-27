import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Provision the schema separately with `prisma migrate deploy`; never point this at public.
test('dashboard summary counts every sidebar section and honours the date range', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/, 'TEST_DATABASE_URL must use an isolated kilo_it_ schema');
  process.env.DATABASE_URL = database.toString();
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '9';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-summary-'));
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  process.env.LOG_DIR = path.join(directory, 'logs');
  process.env.PRIVATE_ARTWORK_DIR = path.join(directory, 'artwork');

  const { default: prisma } = await import('../src/config/db.js');
  const { default: app } = await import('../src/app.js');
  const { signToken } = await import('../src/utils/jwt.js');
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const get = (query, user) => fetch(`${base}/dashboard/summary${query}`, {
    headers: user ? { Authorization: `Bearer ${signToken({ id: user.id })}` } : {},
  }).then(async (res) => ({ status: res.status, body: await res.json() }));

  const suffix = randomUUID().slice(0, 8);
  const daysAgo = (days) => new Date(Date.now() - days * 864e5);
  try {
    const admin = await prisma.user.create({ data: { name: 'Admin', email: `admin-${suffix}@example.invalid`, password: 'x', role: 'ADMIN' } });
    const shopper = await prisma.user.create({ data: { name: 'Shopper', email: `shopper-${suffix}@example.invalid`, password: 'x', role: 'USER' } });

    assert.equal((await get('')).status, 401, 'needs a login');
    assert.equal((await get('', shopper)).status, 403, 'customers cannot read store totals');
    assert.equal((await get('?from=not-a-date', admin)).status, 422);
    assert.equal((await get(`?from=${daysAgo(1).toISOString()}&to=${daysAgo(5).toISOString()}`, admin)).status, 422, 'from must be before to');

    const window = `?from=${daysAgo(30).toISOString()}&to=${new Date(Date.now() + 60000).toISOString()}`;
    const before = (await get(window, admin)).body.data;
    const beforeAll = (await get('', admin)).body.data;

    // Seed: one record of each kind inside the window, plus older ones that only "all time" sees.
    await prisma.user.create({ data: { name: 'Old', email: `old-${suffix}@example.invalid`, password: 'x', role: 'USER', createdAt: daysAgo(60) } });
    await prisma.user.create({ data: { name: 'Recent', email: `recent-${suffix}@example.invalid`, password: 'x', role: 'USER', createdAt: daysAgo(2) } });
    const category = await prisma.category.create({ data: { name: `Summary ${suffix}`, slug: `summary-${suffix}` } });
    const product = await prisma.product.create({ data: { name: 'Mug', slug: `mug-${suffix}`, description: 't', price: 100, stock: 5, images: [], categoryId: category.id } });
    await prisma.product.create({ data: { name: 'Sold out', slug: `out-${suffix}`, description: 't', price: 100, stock: 0, images: [], categoryId: category.id } });
    const address = { fullName: 'Shopper' };
    const recentOrder = await prisma.order.create({ data: { userId: shopper.id, status: 'PROCESSING', totalAmount: 1000, shippingAddress: address } });
    await prisma.order.create({ data: { userId: shopper.id, status: 'DELIVERED', totalAmount: 500, shippingAddress: address } });
    await prisma.order.create({ data: { userId: shopper.id, status: 'CANCELLED', totalAmount: 9999, shippingAddress: address } });
    await prisma.order.create({ data: { userId: shopper.id, status: 'DELIVERED', totalAmount: 700, shippingAddress: address, createdAt: daysAgo(90) } });
    const design = await prisma.customizationDesign.findFirst();
    if (design) {
      await prisma.orderItem.create({ data: { orderId: recentOrder.id, productId: product.id, quantity: 1, price: 100, name: 'Mug', customizationId: design.id, customizationStatus: 'PENDING_REVIEW' } });
    }
    await prisma.enquiry.createMany({ data: [
      { name: 'A', email: `a-${suffix}@example.invalid`, message: 'Hi', subject: 'General Inquiry', status: 'New' },
      { name: 'B', email: `b-${suffix}@example.invalid`, message: 'Please send the catalogue', subject: 'Catalogue Request', status: 'Resolved' },
      { name: 'C', email: `c-${suffix}@example.invalid`, message: 'Appointment requested for Monday', subject: 'Studio Appointment', status: 'New' },
      { name: 'D', email: `d-${suffix}@example.invalid`, message: 'Bulk', subject: 'Bulk Order Inquiry: Mug', status: 'New', type: 'BULK_ORDER', productId: product.id, productName: 'Mug', quantity: 250 },
      { name: 'E', email: `e-${suffix}@example.invalid`, message: 'Old', subject: 'General Inquiry', status: 'New', createdAt: daysAgo(45) },
    ] });

    const { status, body } = await get(window, admin);
    assert.equal(status, 200);
    const after = body.data;
    const delta = (pick) => pick(after) - pick(before);

    assert.equal(delta((s) => s.revenue.total), 1500, 'processing + delivered; cancelled and old orders excluded');
    assert.equal(delta((s) => s.orders.total), 3);
    assert.equal(delta((s) => s.orders.open), 1);
    assert.equal(delta((s) => s.orders.delivered), 1);
    assert.equal(delta((s) => s.products.total), 2, 'products are a current total, not date-limited');
    assert.equal(delta((s) => s.products.lowStock), 1);
    assert.equal(delta((s) => s.products.outOfStock), 1);
    assert.equal(delta((s) => s.categories.total), 1);
    assert.equal(delta((s) => s.customers.total), 1, 'the 60-day-old customer is outside the window');
    assert.equal(delta((s) => s.enquiries.total), 3, 'general + catalogue + bulk; appointments and old ones excluded');
    assert.equal(delta((s) => s.enquiries.new), 2);
    assert.equal(delta((s) => s.bulkOrders.total), 1);
    assert.equal(delta((s) => s.bulkOrders.units), 250);
    assert.equal(delta((s) => s.appointments.total), 1);
    assert.equal(delta((s) => s.appointments.new), 1);
    assert.equal(delta((s) => s.catalogueRequests.total), 1);
    assert.equal(delta((s) => s.catalogueRequests.new), 0);
    assert.equal(delta((s) => s.staff.admins), 0, 'the admin existed before the baseline');
    if (design) assert.equal(delta((s) => s.customizations.pendingReview), 1);

    const all = (await get('', admin)).body.data;
    assert.equal(all.customers.total - beforeAll.customers.total, 2, 'all time includes the old customer');
    assert.equal(all.orders.total - beforeAll.orders.total, 4);
    assert.equal(all.revenue.total - beforeAll.revenue.total, 2200);
    assert.equal(all.enquiries.total - beforeAll.enquiries.total, 4);
    assert.equal(typeof all.coupons.total, 'number');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
