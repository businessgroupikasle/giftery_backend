import prisma from '../config/db.js';
import { sendSuccess } from '../utils/response.js';

export const dashboardController = {
  getStats: async (req, res, next) => {
    try {
      const [
        totalUsers,
        totalProducts,
        totalOrders,
        revenueResult,
        recentOrders,
        topProducts,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { status: 'DELIVERED' },
        }),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.orderItem.groupBy({
          by: ['productId'],
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
      ]);

      sendSuccess(res, {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: revenueResult._sum.totalAmount || 0,
        recentOrders,
        topProducts,
      });
    } catch (err) { next(err); }
  },
};
