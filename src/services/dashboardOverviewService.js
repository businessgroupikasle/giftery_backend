import prisma from '../config/db.js';

/*
 * Charts, top products and the activity feed on the admin dashboard overview,
 * all computed from real orders, enquiries, customers and stock levels.
 *
 * A "sale" is an order that was not cancelled or refunded and, if it was an online
 * payment, whose payment actually succeeded (older unpaid Razorpay orders are not sales).
 */

export const OVERVIEW_RANGES = ['week', 'month', 'year', 'all'];
export const LOW_STOCK_LIMIT = 10;

const UNPAID_ONLINE = { payment: { is: { method: 'RAZORPAY', status: { not: 'SUCCEEDED' } } } };
/** Orders that are real store orders (not an online payment that never completed). */
export const REAL_ORDER_WHERE = { NOT: UNPAID_ONLINE };
/** Orders that count towards revenue. */
export const SALE_WHERE = { status: { notIn: ['CANCELLED', 'REFUNDED'] }, NOT: UNPAID_ONLINE };

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const round2 = (value) => Math.round(value * 100) / 100;

/** First instant of a range ending now: the last 7 days, 30 days or 12 months, or null for all time. */
export const rangeStart = (range, now = new Date()) => {
  if (range === 'week') return addDays(startOfDay(now), -6);
  if (range === 'month') return addDays(startOfDay(now), -29);
  if (range === 'year') return addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -11);
  return null;
};

const createdSince = (start) => (start ? { createdAt: { gte: start } } : {});

/**
 * Daily buckets for week/month, monthly buckets for year, each paired with the bucket one
 * period earlier so the chart can draw "current" against "previous".
 */
export const buildSalesBuckets = (range, now = new Date()) => {
  const monthly = range === 'year';
  const count = range === 'week' ? 7 : range === 'month' ? 30 : 12;
  const start = rangeStart(range, now);
  const step = (date, n) => (monthly ? addMonths(date, n) : addDays(date, n));
  const label = (date) => (monthly
    ? date.toLocaleDateString('en-IN', { month: 'short' })
    : range === 'week'
      ? date.toLocaleDateString('en-IN', { weekday: 'short' })
      : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  return Array.from({ length: count }, (_, i) => {
    const from = step(start, i);
    return { label: label(from), from, to: step(start, i + 1), previousFrom: step(start, i - count), previousTo: step(start, i + 1 - count) };
  });
};

const bucketIndex = (buckets, date, fromKey, toKey) => buckets.findIndex((b) => date >= b[fromKey] && date < b[toKey]);

async function salesSeries(range, now) {
  const salesRange = range === 'all' ? 'year' : range;
  const buckets = buildSalesBuckets(salesRange, now);
  const orders = await prisma.order.findMany({
    where: { ...SALE_WHERE, createdAt: { gte: buckets[0].previousFrom } },
    select: { createdAt: true, totalAmount: true },
  });
  const current = buckets.map(() => 0);
  const previous = buckets.map(() => 0);
  for (const order of orders) {
    const at = new Date(order.createdAt);
    const i = bucketIndex(buckets, at, 'from', 'to');
    if (i >= 0) { current[i] += order.totalAmount; continue; }
    const j = bucketIndex(buckets, at, 'previousFrom', 'previousTo');
    if (j >= 0) previous[j] += order.totalAmount;
  }
  const values = current.map(round2);
  const peakIndex = values.reduce((best, value, i) => (value > values[best] ? i : best), 0);
  return {
    range: salesRange,
    labels: buckets.map((b) => b.label),
    current: values,
    previous: previous.map(round2),
    total: round2(values.reduce((a, b) => a + b, 0)),
    previousTotal: round2(previous.reduce((a, b) => a + b, 0)),
    peak: values[peakIndex] > 0 ? { label: buckets[peakIndex].label, value: values[peakIndex] } : null,
  };
}

async function topCategories(range, now) {
  const items = await prisma.orderItem.findMany({
    where: { order: { ...SALE_WHERE, ...createdSince(rangeStart(range, now)) } },
    select: { price: true, quantity: true, product: { select: { category: { select: { name: true } } } } },
  });
  const totals = new Map();
  for (const item of items) {
    const name = item.product?.category?.name || 'Uncategorised';
    const row = totals.get(name) || { name, revenue: 0, units: 0 };
    row.revenue += item.price * item.quantity;
    row.units += item.quantity;
    totals.set(name, row);
  }
  const rows = [...totals.values()].sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const top = rows.slice(0, 4);
  const rest = rows.slice(4);
  if (rest.length) top.push({ name: 'Other', revenue: rest.reduce((s, r) => s + r.revenue, 0), units: rest.reduce((s, r) => s + r.units, 0) });
  return {
    range,
    total: round2(total),
    categories: top.map((row) => ({ ...row, revenue: round2(row.revenue), pct: total ? Math.round((row.revenue / total) * 1000) / 10 : 0 })),
  };
}

async function orderStatus(range, now) {
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    where: { ...REAL_ORDER_WHERE, ...createdSince(rangeStart(range, now)) },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  return {
    range,
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    // Pending covers everything not yet shipped or closed.
    delivered: counts.DELIVERED || 0,
    shipped: counts.SHIPPED || 0,
    processing: (counts.PROCESSING || 0) + (counts.CONFIRMED || 0),
    pending: counts.PENDING || 0,
    cancelled: (counts.CANCELLED || 0) + (counts.REFUNDED || 0),
  };
}

async function topProducts(range, now, limit = 4) {
  const where = { order: { ...SALE_WHERE, ...createdSince(rangeStart(range, now)) } };
  const ranked = await prisma.orderItem.groupBy({
    by: ['productId'],
    where,
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });
  if (!ranked.length) return { range, products: [] };
  const ids = ranked.map((row) => row.productId);
  const [items, products] = await Promise.all([
    prisma.orderItem.findMany({ where: { ...where, productId: { in: ids } }, select: { productId: true, price: true, quantity: true, name: true, image: true } }),
    prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, images: true, stock: true, sku: true } }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    range,
    products: ranked.map((row) => {
      const lines = items.filter((item) => item.productId === row.productId);
      const product = byId.get(row.productId);
      return {
        id: row.productId,
        name: product?.name || lines[0]?.name || 'Deleted product',
        sku: product?.sku || null,
        image: product?.images?.[0] || lines[0]?.image || null,
        stock: product?.stock ?? null,
        unitsSold: row._sum.quantity || 0,
        revenue: round2(lines.reduce((sum, item) => sum + item.price * item.quantity, 0)),
      };
    }),
  };
}

/** Latest events across the store, newest first. Every entry carries its real timestamp. */
async function recentActivity(limit = 6) {
  const [orders, enquiries, bulk, customers, lowStock] = await Promise.all([
    prisma.order.findMany({
      where: REAL_ORDER_WHERE,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, orderNumber: true, totalAmount: true, createdAt: true, shippingAddress: true, user: { select: { name: true } }, payment: { select: { method: true } } },
    }),
    prisma.enquiry.findMany({
      where: { type: { not: 'BULK_ORDER' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, subject: true, createdAt: true },
    }),
    prisma.enquiry.findMany({
      where: { type: 'BULK_ORDER' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, company: true, productName: true, quantity: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: LOW_STOCK_LIMIT } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, name: true, stock: true, updatedAt: true },
    }),
  ]);

  const events = [
    ...orders.map((o) => ({
      type: 'order', id: o.id, at: o.createdAt, tab: 'orders',
      reference: o.orderNumber || o.id, customer: o.user?.name || o.shippingAddress?.fullName || 'A customer',
      amount: o.totalAmount, paymentMethod: o.payment?.method || 'COD',
    })),
    ...bulk.map((e) => ({
      type: 'bulk', id: e.id, at: e.createdAt, tab: 'bulk-orders',
      reference: e.id, customer: e.company || e.name, productName: e.productName, quantity: e.quantity,
    })),
    ...enquiries.map((e) => ({ type: 'enquiry', id: e.id, at: e.createdAt, tab: 'enquiries', reference: e.id, customer: e.name, subject: e.subject })),
    ...customers.map((u) => ({ type: 'customer', id: u.id, at: u.createdAt, tab: 'customers', customer: u.name })),
    ...lowStock.map((p) => ({ type: p.stock <= 0 ? 'outOfStock' : 'lowStock', id: p.id, at: p.updatedAt, tab: 'products', productName: p.name, stock: p.stock })),
  ];
  return events
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit)
    .map((event) => ({ ...event, at: new Date(event.at).toISOString() }));
}

/**
 * Everything the overview needs below the KPI cards. Each chart has its own range so its
 * dropdown can change independently.
 */
export const getDashboardOverview = async ({ sales = 'week', categories = 'week', status = 'week', products = 'all' } = {}, now = new Date()) => {
  const [salesData, categoryData, statusData, productData, activity, newCustomersThisWeek, bulkNew, lowStock, outOfStock] = await Promise.all([
    salesSeries(sales, now),
    topCategories(categories, now),
    orderStatus(status, now),
    topProducts(products, now),
    recentActivity(),
    prisma.user.count({ where: { role: 'USER', createdAt: { gte: rangeStart('week', now) } } }),
    prisma.enquiry.count({ where: { type: 'BULK_ORDER', status: { equals: 'new', mode: 'insensitive' } } }),
    // Same rules as the KPI cards (GET /dashboard/summary), so both show the same numbers.
    prisma.product.count({ where: { stock: { gt: 0, lte: LOW_STOCK_LIMIT } } }),
    prisma.product.count({ where: { stock: { lte: 0 } } }),
  ]);
  return {
    generatedAt: now.toISOString(),
    sales: salesData,
    categories: categoryData,
    orderStatus: statusData,
    topProducts: productData,
    activity,
    quickStats: { lowStock, outOfStock, newCustomersThisWeek, newBulkInquiries: bulkNew },
  };
};
