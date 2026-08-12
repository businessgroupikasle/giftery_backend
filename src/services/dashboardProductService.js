import { dashboardProductRepository } from '../repositories/dashboardProductRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { productService } from './productService.js';
import { paginate } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { fileUploadHelper } from '../helpers/fileUpload.js';
import prisma from '../config/db.js';

export const dashboardProductService = {
  getProducts: async (query) => {
    const { page = 1, limit = 20, search, categoryId, status, stock, sort = 'newest' } = query;

    let where = {};

    if (status === 'active' || status === 'inactive') {
      where.isActive = status === 'active';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (stock === 'low') {
      where.stock = { gt: 0, lte: 10 };
    } else if (stock === 'outofstock') {
      where.stock = 0;
    }

    const sortMap = {
      newest: { createdAt: 'desc' },
      oldest: { createdAt: 'asc' },
      name_asc: { name: 'asc' },
      name_desc: { name: 'desc' },
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      stock_asc: { stock: 'asc' },
      stock_desc: { stock: 'desc' },
    };

    const orderBy = sortMap[sort] || sortMap.newest;

    const total = await prisma.product.count({ where });
    const meta = paginate(page, limit, total);
    const data = await prisma.product.findMany({
      where,
      skip: meta.skip,
      take: meta.take,
      orderBy,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        comparePrice: true,
        stock: true,
        images: true,
        sku: true,
        isActive: true,
        featured: true,
        isBestseller: true,
        isPopular: true,
        isNewArrival: true,
        isMostLoved: true,
        isGiftSet: true,
        categoryId: true,
        category: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
        _count: { select: { reviews: true } },
      },
    });

    return { data, meta };
  },

  getProductById: async (id) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    return product;
  },

  createProduct: async (data) => {
    return productService.create(data);
  },

  updateProduct: async (id, data) => {
    if (data.images && Array.isArray(data.images)) {
      return productService.updateWithImages(id, data);
    }
    return productService.update(id, data);
  },

  deleteProduct: async (id) => {
    return productService.delete(id);
  },

  updateProductStatus: async (id, isActive) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    return productRepository.update(id, { isActive, updatedAt: new Date() });
  },

  updateInventory: async (id, quantity) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    if (quantity < 0) {
      const err = new Error('Stock cannot be negative');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    return productRepository.update(id, { stock: quantity, updatedAt: new Date() });
  },

  bulkUpdateStatus: async (ids, isActive) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('Invalid product IDs');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const result = await dashboardProductRepository.bulkUpdateStatus(ids, isActive);
    return { updated: result.count, ids };
  },

  bulkDelete: async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('Invalid product IDs');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, images: true },
    });

    const deleted = [];
    const failed = [];

    for (const product of products) {
      try {
        if (product.images && product.images.length > 0) {
          const cleanupResult = fileUploadHelper.deleteImagesByUrls(product.images);
          if (cleanupResult.failed.length > 0) {
            console.warn(`Failed to delete images for product ${product.id}`);
          }
        }

        await prisma.product.delete({ where: { id: product.id } });
        deleted.push(product.id);
      } catch (error) {
        failed.push({ id: product.id, reason: error.message });
      }
    }

    return { deleted, failed, total: ids.length };
  },

  cloneProduct: async (id) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const newSlug = `${product.slug}-clone-${Date.now()}`;
    const clonedProduct = await prisma.product.create({
      data: {
        name: `${product.name} (Clone)`,
        slug: newSlug,
        description: product.description,
        price: product.price,
        comparePrice: product.comparePrice,
        stock: 0,
        images: product.images,
        sku: product.sku ? `${product.sku}-CLONE-${Date.now()}` : null,
        weight: product.weight,
        featured: false,
        isBestseller: product.isBestseller,
        isPopular: product.isPopular,
        isNewArrival: product.isNewArrival,
        isMostLoved: product.isMostLoved,
        isGiftSet: product.isGiftSet,
        isActive: false,
        categoryId: product.categoryId,
        subCategoryId: product.subCategoryId,
        specifications: product.specifications,
        customization: product.customization,
        shippingReturns: product.shippingReturns,
        tags: product.tags,
        rating: product.rating,
        reviewsCount: 0,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stock: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
      },
    });

    return clonedProduct;
  },

  getLowStockProducts: async (threshold = 10, page = 1, limit = 20) => {
    const total = await dashboardProductRepository.countLowStock(threshold);
    const meta = paginate(page, limit, total);
    const data = await dashboardProductRepository.findLowStock({
      threshold,
      skip: meta.skip,
      take: meta.take,
    });

    return { data, meta };
  },

  getOutOfStockProducts: async (page = 1, limit = 20) => {
    const total = await dashboardProductRepository.countOutOfStock();
    const meta = paginate(page, limit, total);
    const data = await dashboardProductRepository.findOutOfStock({
      skip: meta.skip,
      take: meta.take,
    });

    return { data, meta };
  },

  getProductsByStatus: async (status, page = 1, limit = 20) => {
    if (!['active', 'inactive'].includes(status)) {
      const err = new Error('Invalid status');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const total = await dashboardProductRepository.countByStatus(status);
    const meta = paginate(page, limit, total);
    const data = await dashboardProductRepository.findByStatus({
      status,
      skip: meta.skip,
      take: meta.take,
      orderBy: { createdAt: 'desc' },
    });

    return { data, meta };
  },

  getProductsByCategory: async (categoryId, page = 1, limit = 20) => {
    const total = await prisma.product.count({ where: { categoryId } });
    const meta = paginate(page, limit, total);
    const data = await dashboardProductRepository.findByCategory({
      categoryId,
      skip: meta.skip,
      take: meta.take,
    });

    return { data, meta };
  },

  getProductsByTag: async (tag, page = 1, limit = 20) => {
    const total = await prisma.product.count({ where: { tags: { has: tag } } });
    const meta = paginate(page, limit, total);
    const data = await dashboardProductRepository.findByTag({
      tag,
      skip: meta.skip,
      take: meta.take,
    });

    return { data, meta };
  },

  getTopSellingProducts: async (days = 30, limit = 10) => {
    const topProducts = await dashboardProductRepository.getTopSellingProducts({ days, take: limit });

    const products = await prisma.product.findMany({
      where: {
        id: { in: topProducts.map(p => p.productId) },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        images: true,
        category: { select: { name: true } },
      },
    });

    return topProducts.map(tp => ({
      ...products.find(p => p.id === tp.productId),
      totalSold: tp._sum.quantity,
    }));
  },

  getDashboardStats: async () => {
    const [totalProducts, activeProducts, inactiveProducts, lowStockCount, outOfStockCount, totalRevenue] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: 10 } } }),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.orderItem.aggregate({
        _sum: { price: true },
      }),
    ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      lowStockCount,
      outOfStockCount,
      totalRevenue: totalRevenue._sum.price || 0,
    };
  },
};
