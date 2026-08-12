import prisma from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { dashboardProductService } from '../services/dashboardProductService.js';

export const dashboardController = {
  getStats: async (req, res, next) => {
    try {
      const [
        totalUsers,
        totalProducts,
        totalOrders,
        revenueResult,
        pendingOrdersCount,
        processingOrdersCount,
        completedOrdersCount,
        cancelledOrdersCount,
        lowStockCount,
        outOfStockCount,
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
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.order.count({ where: { status: 'PROCESSING' } }),
        prisma.order.count({ where: { status: 'DELIVERED' } }),
        prisma.order.count({ where: { status: 'CANCELLED' } }),
        prisma.product.count({ where: { stock: { gt: 0, lte: 10 } } }),
        prisma.product.count({ where: { stock: 0 } }),
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
        pendingOrdersCount,
        processingOrdersCount,
        completedOrdersCount,
        cancelledOrdersCount,
        lowStockCount,
        outOfStockCount,
        recentOrders,
        topProducts,
      });
    } catch (err) { next(err); }
  },

  getProductStats: async (req, res, next) => {
    try {
      const stats = await dashboardProductService.getDashboardStats();
      sendSuccess(res, stats);
    } catch (err) { next(err); }
  },

  getProducts: async (req, res, next) => {
    try {
      const result = await dashboardProductService.getProducts(req.query);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getProductById: async (req, res, next) => {
    try {
      const product = await dashboardProductService.getProductById(req.params.id);
      sendSuccess(res, { product });
    } catch (err) { next(err); }
  },

  createProduct: async (req, res, next) => {
    try {
      const product = await dashboardProductService.createProduct(req.body);
      sendSuccess(res, { product }, 'Product created', HTTP_STATUS.CREATED);
    } catch (err) { next(err); }
  },

  updateProduct: async (req, res, next) => {
    try {
      const product = await dashboardProductService.updateProduct(req.params.id, req.body);
      sendSuccess(res, { product }, 'Product updated');
    } catch (err) { next(err); }
  },

  deleteProduct: async (req, res, next) => {
    try {
      await dashboardProductService.deleteProduct(req.params.id);
      sendSuccess(res, null, 'Product deleted');
    } catch (err) { next(err); }
  },

  updateProductStatus: async (req, res, next) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return sendError(res, 'isActive must be a boolean', HTTP_STATUS.BAD_REQUEST);
      }
      const product = await dashboardProductService.updateProductStatus(req.params.id, isActive);
      sendSuccess(res, { product }, 'Product status updated');
    } catch (err) { next(err); }
  },

  updateInventory: async (req, res, next) => {
    try {
      const { quantity } = req.body;
      if (typeof quantity !== 'number' || quantity < 0) {
        return sendError(res, 'quantity must be a non-negative number', HTTP_STATUS.BAD_REQUEST);
      }
      const product = await dashboardProductService.updateInventory(req.params.id, quantity);
      sendSuccess(res, { product }, 'Inventory updated');
    } catch (err) { next(err); }
  },

  bulkUpdateStatus: async (req, res, next) => {
    try {
      const { ids, isActive } = req.body;
      if (!Array.isArray(ids) || typeof isActive !== 'boolean') {
        return sendError(res, 'ids must be an array and isActive must be a boolean', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await dashboardProductService.bulkUpdateStatus(ids, isActive);
      sendSuccess(res, result, 'Bulk status update completed');
    } catch (err) { next(err); }
  },

  bulkDelete: async (req, res, next) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return sendError(res, 'ids must be an array', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await dashboardProductService.bulkDelete(ids);
      sendSuccess(res, result, 'Bulk deletion completed');
    } catch (err) { next(err); }
  },

  cloneProduct: async (req, res, next) => {
    try {
      const product = await dashboardProductService.cloneProduct(req.params.id);
      sendSuccess(res, { product }, 'Product cloned', HTTP_STATUS.CREATED);
    } catch (err) { next(err); }
  },

  getLowStockProducts: async (req, res, next) => {
    try {
      const { page = '1', limit = '20', threshold = '10' } = req.query;
      const result = await dashboardProductService.getLowStockProducts(parseInt(threshold), parseInt(page), parseInt(limit));
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getOutOfStockProducts: async (req, res, next) => {
    try {
      const { page = '1', limit = '20' } = req.query;
      const result = await dashboardProductService.getOutOfStockProducts(parseInt(page), parseInt(limit));
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getProductsByStatus: async (req, res, next) => {
    try {
      const { status, page = '1', limit = '20' } = req.query;
      if (!status) {
        return sendError(res, 'status query parameter is required', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await dashboardProductService.getProductsByStatus(status, parseInt(page), parseInt(limit));
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getTopSellingProducts: async (req, res, next) => {
    try {
      const { days = '30', limit = '10' } = req.query;
      const products = await dashboardProductService.getTopSellingProducts(parseInt(days), parseInt(limit));
      sendSuccess(res, { products });
    } catch (err) { next(err); }
  },
};
