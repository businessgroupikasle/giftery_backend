import prisma from '../config/db.js';

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  comparePrice: true,
  stock: true,
  images: true,
  sku: true,
  weight: true,
  featured: true,
  isBestseller: true,
  isPopular: true,
  isNewArrival: true,
  isMostLoved: true,
  isGiftSet: true,
  isActive: true,
  categoryId: true,
  subCategoryId: true,
  specifications: true,
  customization: true,
  shippingReturns: true,
  tags: true,
  rating: true,
  reviewsCount: true,
  category: { select: { id: true, name: true, slug: true } },
  createdAt: true,
  updatedAt: true,
  _count: { select: { reviews: true } },
};

export const dashboardProductRepository = {
  findByStatus: ({ status, skip, take, orderBy }) => {
    const where = status === 'active' ? { isActive: true } : { isActive: false };
    return prisma.product.findMany({ where, skip, take, orderBy, select: productSelect });
  },

  countByStatus: (status) => {
    const where = status === 'active' ? { isActive: true } : { isActive: false };
    return prisma.product.count({ where });
  },

  findLowStock: ({ threshold = 10, skip = 0, take = 20 }) =>
    prisma.product.findMany({
      where: { stock: { gt: 0, lte: threshold } },
      skip,
      take,
      orderBy: { stock: 'asc' },
      select: productSelect,
    }),

  countLowStock: (threshold = 10) =>
    prisma.product.count({ where: { stock: { gt: 0, lte: threshold } } }),

  findOutOfStock: ({ skip = 0, take = 20 }) =>
    prisma.product.findMany({
      where: { stock: 0 },
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      select: productSelect,
    }),

  countOutOfStock: () =>
    prisma.product.count({ where: { stock: 0 } }),

  findByTag: ({ tag, skip = 0, take = 20 }) =>
    prisma.product.findMany({
      where: { tags: { has: tag } },
      skip,
      take,
      select: productSelect,
    }),

  findByCategory: ({ categoryId, skip = 0, take = 20 }) =>
    prisma.product.findMany({
      where: { categoryId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: productSelect,
    }),

  search: ({ query, skip = 0, take = 20 }) =>
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ],
      },
      skip,
      take,
      select: productSelect,
    }),

  bulkUpdateStatus: async (ids, isActive) => {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive, updatedAt: new Date() },
    });
    return result;
  },

  bulkDelete: async (ids) => {
    const result = await prisma.product.deleteMany({
      where: { id: { in: ids } },
    });
    return result;
  },

  bulkUpdate: async (updates) => {
    const results = {
      succeeded: [],
      failed: [],
    };

    for (const update of updates) {
      try {
        const product = await prisma.product.update({
          where: { id: update.id },
          data: update.data,
          select: productSelect,
        });
        results.succeeded.push(product);
      } catch (error) {
        results.failed.push({ id: update.id, reason: error.message });
      }
    }

    return results;
  },

  getProductsWithReviewStats: ({ skip = 0, take = 20 }) =>
    prisma.product.findMany({
      skip,
      take,
      select: {
        ...productSelect,
        reviews: {
          select: {
            id: true,
            rating: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  getTopSellingProducts: ({ days = 30, take = 10 }) => {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        order: {
          createdAt: { gte: dateFrom },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take,
    });
  },
};
