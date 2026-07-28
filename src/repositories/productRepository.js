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
  featured: true,
  isActive: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
  createdAt: true,
  _count: { select: { reviews: true } },
};

export const productRepository = {
  findMany: ({ skip, take, where, orderBy }) =>
    prisma.product.findMany({ where, skip, take, orderBy, select: productSelect }),

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
