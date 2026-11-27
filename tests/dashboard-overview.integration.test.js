import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Provision the schema separately with `prisma migrate deploy`; never point this at public.
test('dashboard overview is computed from real sales only', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/, 'TEST_DATABASE_URL must use an isolated kilo_it_ schema');
  process.env.DATABASE_URL = database.toString();
  const { default: prisma } = await import('../src/config/db.js');
  const { getDashboardOverview } = await import('../src/services/dashboardOverviewService.js');
  const { getDashboardSummary } = await import('../src/services/dashboardSummaryService.js');

  try {
    const s = randomUUID().slice(0, 8);
    const now = new Date();
    const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const customer = await prisma.user.create({ data: { name: 'Meena', email: `meena-${s}@example.invalid`, password: 'x', createdAt: daysAgo(1) } });
    const [mugs, toys] = await Promise.all(['Mugs', 'Toys'].map((name) => prisma.category.create({ data: { name: `${name} ${s}`, slug: `${name.toLowerCase()}-${s}` } })));
    const mug = await prisma.product.create({ data: { name: 'Photo Mug', slug: `mug-${s}`, description: 'd', price: 300, stock: 50, images: ['/mug.png'], categoryId: mugs.id } });
    const bear = await prisma.product.create({ data: { name: 'Teddy Bear', slug: `bear-${s}`, description: 'd', price: 500, stock: 3, images: [], categoryId: toys.id } });

    const order = (n, { status = 'PENDING', method = 'COD', paid = 'PENDING', at = daysAgo(1), lines }) => prisma.order.create({ data: {
      userId: customer.id, orderNumber: `ORD-2026-T${s}${n}`.toUpperCase(), status, createdAt: at,
      totalAmount: lines.reduce((sum, [product, qty]) => sum + product.price * qty, 0), shippingAddress: { fullName: 'Meena' },
      payment: { create: { method, status: paid, amount: 0, currency: 'INR' } },
      items: { create: lines.map(([product, qty]) => ({ productId: product.id, quantity: qty, price: product.price, name: product.name })) },
    } });
    await order(1, { lines: [[mug, 4]] });                                             // COD, counts: 1200
    await order(2, { method: 'RAZORPAY', paid: 'SUCCEEDED', status: 'DELIVERED', lines: [[bear, 2]] }); // paid online: 1000
    await order(3, { method: 'RAZORPAY', paid: 'PENDING', lines: [[bear, 9]] });       // never paid: ignored everywhere
    await order(4, { status: 'CANCELLED', lines: [[mug, 7]] });                        // cancelled: not a sale
    await order(5, { at: daysAgo(10), lines: [[mug, 1]] });                            // 300, outside "week"
    await prisma.enquiry.create({ data: { id: `ENQ-T-${s}`, type: 'BULK_ORDER', name: 'Ravi', email: `r-${s}@example.invalid`, message: 'm', company: 'Acme', productName: 'Teddy Bear', quantity: 500, status: 'New' } });

    const overview = await getDashboardOverview({ sales: 'week', categories: 'week', status: 'week', products: 'all' }, now);

    assert.equal(overview.sales.labels.length, 7);
    assert.equal(overview.sales.total, 2200, 'week sales = COD 1200 + paid online 1000');
    assert.equal(overview.sales.previousTotal, 300, 'the order 10 days ago falls in the previous week');
    assert.equal(overview.sales.peak.value, 2200);

    assert.equal(overview.categories.total, 2200);
    assert.deepEqual(overview.categories.categories.map((c) => [c.name, c.revenue, c.units]), [[`Mugs ${s}`, 1200, 4], [`Toys ${s}`, 1000, 2]]);

    assert.equal(overview.orderStatus.total, 3, 'unpaid online order is not an order; the 10-day-old one is outside the week');
    assert.equal(overview.orderStatus.delivered, 1);
    assert.equal(overview.orderStatus.pending, 1);
    assert.equal(overview.orderStatus.cancelled, 1);

    assert.deepEqual(overview.topProducts.products.map((p) => [p.name, p.unitsSold, p.revenue]), [['Photo Mug', 5, 1500], ['Teddy Bear', 2, 1000]], 'cancelled and unpaid lines do not count as sold');
    assert.equal(overview.topProducts.products[0].image, '/mug.png');

    const types = overview.activity.map((e) => e.type);
    assert.ok(types.includes('order') && types.includes('bulk') && types.includes('customer') && types.includes('lowStock'));
    assert.ok(!overview.activity.some((e) => e.type === 'order' && e.reference.endsWith('3')), 'the unpaid online order is not shown as activity');
    assert.deepEqual([...overview.activity].sort((a, b) => new Date(b.at) - new Date(a.at)), overview.activity, 'newest first');
    assert.equal(overview.activity.find((e) => e.type === 'bulk').customer, 'Acme');
    assert.equal(overview.activity.find((e) => e.type === 'lowStock').productName, 'Teddy Bear');

    assert.equal(overview.quickStats.newCustomersThisWeek, 1);
    assert.equal(overview.quickStats.newBulkInquiries, 1);
    assert.equal(overview.quickStats.lowStock, 1);

    const summary = await getDashboardSummary({});
    assert.equal(summary.revenue.total, 2500, 'KPI revenue uses the same sale rules as the charts');
  } finally {
    await prisma.$disconnect();
  }
});
