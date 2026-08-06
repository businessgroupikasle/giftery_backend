import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import prisma from '../config/db.js';

const router = Router();

// ── 1. GET /users — List all registered users (Admin only) ────
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

// ── 2. GET /users/me or /users/profile — Logged-in User Profile ──
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, avatar: true, isActive: true, createdAt: true,
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

// ── 3. PUT /users/profile — Update Logged-in User Profile in DB ──
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const userId = req.user.id || req.user.userId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
      },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, avatar: true, isActive: true, createdAt: true,
      },
    });

    sendSuccess(res, { user: updatedUser }, 'Profile updated successfully in database');
  } catch (err) {
    next(err);
  }
});

// ── 4. PUT /users/change-password — Change Password in DB ──
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password if password exists
    if (user.password) {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    sendSuccess(res, null, 'Password updated successfully in database');
  } catch (err) {
    next(err);
  }
});

// ── 5. GET /users/address — Get Logged-in User's Latest Delivery Address ──
router.get('/address', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const address = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, { address });
  } catch (err) {
    next(err);
  }
});

// ── 6. PUT /users/address — Save Delivery Address in DB ──
router.put('/address', authenticate, async (req, res, next) => {
  try {
    const { street, city, state, zip, pincode, country } = req.body;
    const userId = req.user.id || req.user.userId;
    const zipCode = zip || pincode || '641045';

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        fullName: user.name || 'User',
        street: street || '',
        city: city || '',
        state: state || '',
        zip: zipCode,
        country: country || 'India',
      },
    });

    sendSuccess(res, { address }, 'Address saved successfully in database');
  } catch (err) {
    next(err);
  }
});

// ── 7. PUT /users/:id/status — Toggle User Active/Inactive (Admin only) ──
router.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive (boolean) is required' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });

    sendSuccess(res, { user }, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    next(err);
  }
});

// ── 8. GET /users/:id — Get Single User by ID (Admin only) ──
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

export default router;
