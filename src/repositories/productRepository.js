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
  category: { select: { id: true, name: true, slug: true, parentId: true } },
  createdAt: true,
  updatedAt: true,
  _count: { select: { reviews: true } },
};

// Storefront listing pages only need card/filter fields, not the long text columns
const { description, specifications, customization, shippingReturns, weight, ...productListSelect } = productSelect;

export const productRepository = {
  findMany: ({ skip, take, where, orderBy, lite = false }) =>
    prisma.product.findMany({ where, skip, take, orderBy, select: lite ? productListSelect : productSelect }),

  count: (where) => prisma.product.count({ where }),

  findBySlug: (slug) =>
    prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        reviews: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { reviews: true } },
      },
    }),

  findById: (id) => prisma.product.findUnique({ where: { id }, select: productSelect }),

  create: (data) => prisma.product.create({ data, select: productSelect }),

  update: (id, data) => prisma.product.update({ where: { id }, data, select: productSelect }),

  delete: (id) => prisma.product.delete({ where: { id } }),

  existsBySlug: (slug, excludeId) =>
    prisma.product.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } }),
};
