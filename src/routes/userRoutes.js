import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import prisma from '../config/db.js';

const router = Router();

// GET /users — List all registered users (Admin only)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { role, limit = 500, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (role && role !== 'ALL') {
      where.role = role.toUpperCase();
    } else {
      where.role = { in: ['USER', 'CUSTOMER'] };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          orders: {
            select: {
              id: true,
              totalAmount: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || 'Not provided',
      role: u.role || 'CUSTOMER',
      ordersCount: u.orders?.length || 0,
      totalSpent: u.orders?.reduce((sum, o) => sum + (o.totalAmount || 0), 0) || 0,
      joinedDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent',
      status: u.isActive ? 'Active' : 'Inactive',
      createdAt: u.createdAt,
    }));

    sendSuccess(res, { users: formattedUsers, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id — Get single user by ID (Admin only)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, avatar: true, isActive: true,
        isEmailVerified: true, createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id — Delete user (Admin only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'User deleted successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
