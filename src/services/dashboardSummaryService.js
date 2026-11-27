import prisma from '../config/db.js';
import { summarizeCoupons } from '../controllers/couponController.js';
import { SALE_WHERE } from './dashboardOverviewService.js';

/*
 * One count per admin sidebar section, read straight from the database so the
 * overview cards show real totals rather than whatever page of a list is loaded.
 *
 * Activity (orders, revenue, customers, enquiries, bulk orders, appointments,
 * catalogue requests, customizations) is counted inside the optional from/to range.
 * Catalogue-style data (products, categories, coupons, staff) is always the current total.
 */

const NEW_STATUS = { equals: 'new', mode: 'insensitive' };
const OPEN_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'];
const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'VENDOR'];

// Same rules the Appointments and Catalogue Requests screens use to pick their records.
export const APPOINTMENT_WHERE = {
  OR: [
    { subject: { contains: 'studio appointment', mode: 'insensitive' } },
    { message: { contains: 'appointment requested for', mode: 'insensitive' } },
  ],
};
export const CATALOGUE_WHERE = {
  OR: [
    { subject: { contains: 'catalogue', mode: 'insensitive' } },
    { message: { contains: 'catalogue', mode: 'insensitive' } },
  ],
};

const createdBetween = ({ from, to } = {}) => (from || to
  ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
  : {});

export const getDashboardSummary = async (range = {}) => {
  const inRange = createdBetween(range);
  const enquiriesInRange = (where) => ({ AND: [inRange, where] });
  const customizedItems = { customizationId: { not: null }, ...(inRange.createdAt && { order: inRange }) };

  const [
    revenue,
    ordersTotal, ordersOpen, ordersDelivered,
    productsTotal, productsLowStock, productsOutOfStock,
    categoriesTotal,
    customizationsTotal, customizationsPending,
    customersTotal,
    enquiriesTotal, enquiriesNew,
    bulkTotal, bulkNew, bulkUnits,
    appointmentsTotal, appointmentsNew,
    catalogueTotal, catalogueNew,
    staffByRole,
  ] = await Promise.all([
    // Revenue counts sales only: not cancelled/refunded, and online payments that succeeded.
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { ...inRange, ...SALE_WHERE } }),
    prisma.order.count({ where: inRange }),
    prisma.order.count({ where: { ...inRange, status: { in: OPEN_ORDER_STATUSES } } }),
    prisma.order.count({ where: { ...inRange, status: 'DELIVERED' } }),
    prisma.product.count(),
    prisma.product.count({ where: { stock: { gt: 0, lte: 10 } } }),
    prisma.product.count({ where: { stock: { lte: 0 } } }),
    prisma.category.count(),
    prisma.orderItem.count({ where: customizedItems }),
    prisma.orderItem.count({ where: { ...customizedItems, customizationStatus: 'PENDING_REVIEW' } }),
    prisma.user.count({ where: { ...inRange, role: 'USER' } }),
    prisma.enquiry.count({ where: enquiriesInRange({ NOT: APPOINTMENT_WHERE }) }),
    prisma.enquiry.count({ where: enquiriesInRange({ NOT: APPOINTMENT_WHERE, status: NEW_STATUS }) }),
    prisma.enquiry.count({ where: { ...inRange, type: 'BULK_ORDER' } }),
    prisma.enquiry.count({ where: { ...inRange, type: 'BULK_ORDER', status: NEW_STATUS } }),
    prisma.enquiry.aggregate({ _sum: { quantity: true }, where: { ...inRange, type: 'BULK_ORDER' } }),
    prisma.enquiry.count({ where: enquiriesInRange(APPOINTMENT_WHERE) }),
    prisma.enquiry.count({ where: enquiriesInRange({ ...APPOINTMENT_WHERE, status: NEW_STATUS }) }),
    prisma.enquiry.count({ where: enquiriesInRange(CATALOGUE_WHERE) }),
    prisma.enquiry.count({ where: enquiriesInRange({ ...CATALOGUE_WHERE, status: NEW_STATUS }) }),
    prisma.user.groupBy({ by: ['role'], where: { role: { in: STAFF_ROLES } }, _count: { _all: true } }),
  ]);

  const staff = Object.fromEntries(staffByRole.map((row) => [row.role, row._count._all]));

  return {
    range: { from: range.from?.toISOString() || null, to: range.to?.toISOString() || null },
    revenue: { total: revenue._sum.totalAmount || 0 },
    orders: { total: ordersTotal, open: ordersOpen, delivered: ordersDelivered },
    products: { total: productsTotal, lowStock: productsLowStock, outOfStock: productsOutOfStock },
    categories: { total: categoriesTotal },
    customizations: { total: customizationsTotal, pendingReview: customizationsPending },
    customers: { total: customersTotal },
    enquiries: { total: enquiriesTotal, new: enquiriesNew },
    bulkOrders: { total: bulkTotal, new: bulkNew, units: bulkUnits._sum.quantity || 0 },
    appointments: { total: appointmentsTotal, new: appointmentsNew },
    catalogueRequests: { total: catalogueTotal, new: catalogueNew },
    coupons: summarizeCoupons(),
    staff: {
      total: STAFF_ROLES.reduce((sum, role) => sum + (staff[role] || 0), 0),
      admins: staff.ADMIN || 0,
      superAdmins: staff.SUPER_ADMIN || 0,
      vendors: staff.VENDOR || 0,
    },
  };
};
