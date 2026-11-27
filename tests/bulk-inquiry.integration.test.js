import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Provision the schema separately with `prisma migrate deploy`; never point this at public.
test('bulk order inquiry is validated, stored against the product and never touches pricing or orders', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/, 'TEST_DATABASE_URL must use an isolated kilo_it_ schema');
  process.env.DATABASE_URL = database.toString();
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '100000';
  // Point mail at a closed local port so a test run never emails real inboxes
  // (dotenv does not override variables that are already set).
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '9';
  process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.invalid';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-bulk-'));
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  process.env.LOG_DIR = path.join(directory, 'logs');
  process.env.PRIVATE_ARTWORK_DIR = path.join(directory, 'artwork');

  const { default: prisma } = await import('../src/config/db.js');
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const post = (body) => fetch(`${base}/enquiries/bulk-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));

  try {
    const suffix = randomUUID();
    const category = await prisma.category.create({ data: { name: 'Bulk', slug: `bulk-${suffix}` } });
    const product = await prisma.product.create({ data: {
      name: 'Bulk Test Mug', slug: `bulk-mug-${suffix}`, description: 'Test', price: 499, stock: 10,
      images: [], sku: `BULK-${suffix.slice(0, 8)}`, categoryId: category.id,
    } });
    const hidden = await prisma.product.create({ data: {
      name: 'Hidden', slug: `bulk-hidden-${suffix}`, description: 'Test', price: 10, stock: 1, images: [], categoryId: category.id, isActive: false,
    } });
    const ordersBefore = await prisma.order.count();
    const email = `bulk-${suffix}@example.invalid`;
    const body = {
      productId: product.id,
      productName: 'Tampered name',
      productSku: 'TAMPERED',
      quantity: '250',
      name: 'Bulk Buyer',
      email,
      phone: '+919876543210',
      company: 'Acme Ltd',
      requirements: 'Logo print',
    };

    const invalid = await post({ ...body, quantity: 0, email: 'nope' });
    assert.equal(invalid.status, 422);
    assert.ok(invalid.body.errors.some((e) => e.field === 'quantity'));
    assert.ok(invalid.body.errors.some((e) => e.field === 'email'));

    const belowMinimum = await post({ ...body, quantity: 99 });
    assert.equal(belowMinimum.status, 422, 'bulk orders start at 100 units');
    assert.equal(belowMinimum.body.message, 'Minimum bulk order quantity is 100 units');

    const badPhone = await post({ ...body, phone: '12345' });
    assert.equal(badPhone.status, 400);

    const inactive = await post({ ...body, productId: hidden.id });
    assert.equal(inactive.status, 404);
    const missing = await post({ ...body, productId: 'does-not-exist' });
    assert.equal(missing.status, 404);

    const created = await post(body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.data.id, /^ENQ-\d{4}-\d{4,}$/);

    const stored = await prisma.enquiry.findUnique({ where: { id: created.body.data.id } });
    assert.equal(stored.type, 'BULK_ORDER');
    assert.equal(stored.productId, product.id);
    assert.equal(stored.productName, 'Bulk Test Mug', 'name snapshot comes from the database, not the client');
    assert.equal(stored.productSku, product.sku);
    assert.equal(stored.quantity, 250);
    assert.equal(stored.company, 'Acme Ltd');
    assert.equal(stored.requirements, 'Logo print');
    assert.equal(stored.phone, '+919876543210');
    assert.equal(stored.subject, 'Bulk Order Inquiry: Bulk Test Mug');
    assert.ok(stored.createdAt instanceof Date);

    const repeat = await post(body);
    assert.equal(repeat.status, 409, 'a repeat inquiry for the same product and email is refused');
    assert.equal(await prisma.enquiry.count({ where: { email } }), 1);

    // Admin dashboard "Bulk Orders" tab
    const { signToken } = await import('../src/utils/jwt.js');
    const [admin, customer] = await Promise.all(['ADMIN', 'USER'].map((role) => prisma.user.create({ data: {
      name: `Bulk ${role}`, email: `bulk-${role.toLowerCase()}-${suffix}@example.invalid`, password: 'not-a-login-password', role,
    } })));
    const as = (user) => ({ Authorization: `Bearer ${signToken({ id: user.id })}` });
    const call = (url, headers = {}, options = {}) => fetch(`${base}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...headers } })
      .then(async (res) => ({ status: res.status, body: await res.json() }));

    assert.equal((await call('/enquiries/bulk-orders')).status, 401, 'bulk inquiries need a login');
    assert.equal((await call('/enquiries/bulk-orders', as(customer))).status, 403, 'customers cannot read bulk inquiries');
    assert.equal((await call('/enquiries')).status, 401, 'customer enquiries are not public');

    const bulkList = await call(`/enquiries/bulk-orders?search=${encodeURIComponent(email)}`, as(admin));
    assert.equal(bulkList.status, 200, JSON.stringify(bulkList.body));
    assert.equal(bulkList.body.data.meta.total, 1);
    const row = bulkList.body.data.data[0];
    assert.equal(row.id, stored.id);
    assert.equal(row.productName, 'Bulk Test Mug');
    assert.equal(row.quantity, 250);
    assert.ok(bulkList.body.data.counts.New >= 1);

    assert.equal((await call(`/enquiries/bulk-orders/${stored.id}/status`, as(admin), { method: 'PATCH', body: JSON.stringify({ status: 'Shipped' }) })).status, 422);
    const moved = await call(`/enquiries/bulk-orders/${stored.id}/status`, as(admin), { method: 'PATCH', body: JSON.stringify({ status: 'Quoted' }) });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.data.status, 'Quoted');
    assert.equal((await call(`/enquiries/bulk-orders?status=Quoted&search=${encodeURIComponent(email)}`, as(admin))).body.data.meta.total, 1);
    assert.equal((await call(`/enquiries/bulk-orders?status=New&search=${encodeURIComponent(email)}`, as(admin))).body.data.meta.total, 0);

    const general = await call('/enquiries', as(admin));
    assert.equal(general.status, 200);
    assert.ok(!general.body.data.some((e) => e.id === stored.id), 'bulk inquiries live in their own tab, not the general enquiries list');
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, customer.id] } } });

    const productAfter = await prisma.product.findUnique({ where: { id: product.id } });
    assert.equal(productAfter.price, 499, 'product price is unchanged');
    assert.equal(await prisma.order.count(), ordersBefore, 'no order is created');

    await prisma.enquiry.deleteMany({ where: { email } });
    await prisma.product.deleteMany({ where: { categoryId: category.id } });
    await prisma.category.delete({ where: { id: category.id } });
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
