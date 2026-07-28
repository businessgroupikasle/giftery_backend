import prisma from '../config/db.js';

const orderInclude = {
  items: {
    include: { product: { select: { id: true, name: true, slug: true, images: true } } },
  },
  payment: true,
};

export const orderRepository = {
  findByUserId: (userId, { skip, take }) =>
    prisma.order.findMany({ where: { userId }, include: orderInclude, skip, take, orderBy: { createdAt: 'desc' } }),

  countByUserId: (userId) => prisma.order.count({ where: { userId } }),

  findAll: ({ skip, take, where }) =>
    prisma.order.findMany({ where, include: { ...orderInclude, user: { select: { id: true, name: true, email: true } } }, skip, take, orderBy: { createdAt: 'desc' } }),

  countAll: (where) => prisma.order.count({ where }),

  findById: (id) =>
    prisma.order.findUnique({ where: { id }, include: { ...orderInclude, user: { select: { id: true, name: true, email: true } } } }),

  create: (data) => prisma.order.create({ data, include: orderInclude }),

  updateStatus: (id, status) => prisma.order.update({ where: { id }, data: { status } }),
};
