import prisma from '../config/db.js';
import { sendSuccess } from '../utils/response.js';

export const reportController = {
  getSummary: async (req, res, next) => {
    try {
      const [orderCount, deliveredCount, revenueResult, topCategory] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: 'DELIVERED' } }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { status: 'DELIVERED' },
        }),
        prisma.category.findFirst({
          select: { name: true },
        }),
      ]);

      const fulfillmentRate = orderCount > 0 ? `${Math.round((deliveredCount / orderCount) * 100)}%` : '0%';
      const totalRevenue = revenueResult._sum.totalAmount || 0;

      const summary = {
        monthlyRevenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
        orderFulfillmentRate: fulfillmentRate,
        topCategory: topCategory?.name || 'All Categories',
        recentSalesGrowth: totalRevenue > 0 ? '+100%' : '0%',
        monthlyBreakdown: [],
      };

      sendSuccess(res, summary, 'Analytics summary fetched');
    } catch (err) {
      next(err);
    }
  },
};

