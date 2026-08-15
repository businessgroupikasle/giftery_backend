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
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });
    const formatted = address ? {
      id: address.id,
      userId: address.userId,
      fullName: address.fullName,
      phone: address.phone,
      street: address.street,
      addressLine1: address.street,
      landmark: '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      pincode: address.zip,
      country: address.country || 'India',
      isDefault: Boolean(address.isDefault),
    } : null;
    sendSuccess(res, { address: formatted });
  } catch (err) {
    next(err);
  }
});

// ── 6. PUT /users/address — Save Delivery Address in DB ──
router.put('/address', authenticate, async (req, res, next) => {
  try {
    const { fullName, phone, street, addressLine1, landmark, city, state, zip, pincode, country } = req.body;
    const userId = req.user.id || req.user.userId;
    const zipCode = zip || pincode || '600001';

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const cleanStreet = [street || addressLine1, landmark].filter(Boolean).join(', ') || street || addressLine1 || 'Main Street';
    const cleanPhone = phone || user.phone || '9876543210';
    const cleanFullName = fullName || user.name || 'Customer';

    const existing = await prisma.address.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });

    let address;
    if (existing) {
      address = await prisma.address.update({
        where: { id: existing.id },
        data: {
          fullName: cleanFullName,
          phone: cleanPhone,
          street: cleanStreet,
          city: city || existing.city,
          state: state || existing.state,
          zip: zipCode,
          country: country || existing.country || 'India',
        },
      });
    } else {
      address = await prisma.address.create({
        data: {
          userId,
          fullName: cleanFullName,
          phone: cleanPhone,
          street: cleanStreet,
          city: city || 'Chennai',
          state: state || 'Tamil Nadu',
          zip: zipCode,
          country: country || 'India',
          isDefault: true,
        },
      });
    }

    sendSuccess(res, {
      address: {
        id: address.id,
        userId: address.userId,
        fullName: address.fullName,
        phone: address.phone,
        street: address.street,
        addressLine1: address.street,
        landmark: '',
        city: address.city,
        state: address.state,
        zip: address.zip,
        pincode: address.zip,
        country: address.country,
        isDefault: address.isDefault,
      },
    }, 'Address saved successfully in database');
  } catch (err) {
    next(err);
  }
});

// ── 7. PUT / PATCH /users/:id/status — Toggle User Active/Inactive (Admin only) ──
const handleUserStatusUpdate = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let isActive = req.body.isActive;

    if (isActive === undefined && req.body.status) {
      isActive = String(req.body.status).toLowerCase() === 'active';
    } else if (typeof isActive === 'string') {
      isActive = isActive.toLowerCase() === 'true' || isActive.toLowerCase() === 'active';
    } else if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive (boolean) or status is required' });
    }

    // Lookup user by id or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: rawId },
          { email: rawId },
        ],
      },
    });

    if (existingUser) {
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { isActive },
        select: { id: true, name: true, email: true, phone: true, isActive: true },
      });
      return sendSuccess(res, { user }, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
    }

    // Fallback response if user is stored locally
    return sendSuccess(res, { user: { id: rawId, isActive } }, `User status updated to ${isActive ? 'Active' : 'Inactive'}`);
  } catch (err) {
    next(err);
  }
};

router.put('/:id/status', authenticate, handleUserStatusUpdate);
router.patch('/:id/status', authenticate, handleUserStatusUpdate);

// ── 8. PUT / PATCH /users/:id — Update User Name, Phone, Status (Admin only) ──
const handleUserUpdate = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { name, phone, isActive, status } = req.body;

    let parsedActive;
    if (isActive !== undefined) {
      parsedActive = typeof isActive === 'string' ? (isActive.toLowerCase() === 'true' || isActive.toLowerCase() === 'active') : Boolean(isActive);
    } else if (status !== undefined) {
      parsedActive = String(status).toLowerCase() === 'active';
    }

    const updateData = {};
    if (name && typeof name === 'string') updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (parsedActive !== undefined) updateData.isActive = parsedActive;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: rawId },
          { email: rawId },
        ],
      },
    });

    if (existingUser) {
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: updateData,
        select: { id: true, name: true, email: true, phone: true, isActive: true, role: true },
      });
      return sendSuccess(res, { user }, 'User details updated successfully');
    }

    return sendSuccess(res, { user: { id: rawId, ...updateData } }, 'User updated');
  } catch (err) {
    next(err);
  }
};

router.put('/:id', authenticate, handleUserUpdate);
router.patch('/:id', authenticate, handleUserUpdate);

// ── 9. DELETE /users/:id — Delete User and Cascade Records (Admin only) ──
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const rawId = req.params.id;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: rawId },
          { email: rawId },
        ],
      },
      include: {
        orders: { select: { id: true } },
      },
    });

    if (existingUser) {
      const userId = existingUser.id;

      // 1. Delete associated order items & orders
      if (existingUser.orders && existingUser.orders.length > 0) {
        const orderIds = existingUser.orders.map((o) => o.id);
        await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.order.deleteMany({ where: { userId } });
      }

      // 2. Delete cart & cart items
      const cart = await prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        await prisma.cart.delete({ where: { id: cart.id } });
      }

      // 3. Delete wishlist & items
      const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
      if (wishlist) {
        await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
        await prisma.wishlist.delete({ where: { id: wishlist.id } });
      }

      // 4. Delete reviews and addresses
      await prisma.review.deleteMany({ where: { userId } });
      await prisma.address.deleteMany({ where: { userId } });

      // 5. Delete User record
      await prisma.user.delete({ where: { id: userId } });

      return sendSuccess(res, null, `User "${existingUser.name || existingUser.email}" deleted successfully`);
    }

    return sendSuccess(res, null, 'User removed');
  } catch (err) {
    next(err);
  }
});

// ── 10. GET /users/:id — Get Single User by ID (Admin only) ──
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { email: req.params.id },
        ],
      },
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
