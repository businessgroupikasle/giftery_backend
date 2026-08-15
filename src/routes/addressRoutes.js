import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import prisma from '../config/db.js';

const router = Router();

// Protect all address routes with authentication
router.use(authenticate);

const formatAddress = (addr) => {
  if (!addr) return null;
  return {
    id: addr.id,
    userId: addr.userId,
    fullName: addr.fullName,
    phone: addr.phone,
    street: addr.street,
    addressLine1: addr.street,
    landmark: '',
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    pincode: addr.zip,
    country: addr.country || 'India',
    isDefault: Boolean(addr.isDefault),
  };
};

// ── 1. GET /api/v1/addresses — List all saved addresses for logged-in user ──
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });

    const formatted = addresses.map(formatAddress);
    const defaultAddress = formatted.find(a => a.isDefault) || formatted[0] || null;

    sendSuccess(res, { addresses: formatted, defaultAddress, total: formatted.length });
  } catch (err) {
    next(err);
  }
});

// ── 2. GET /api/v1/addresses/:id — Get specific saved address ──
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const address = await prisma.address.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    sendSuccess(res, { address: formatAddress(address) });
  } catch (err) {
    next(err);
  }
});

// ── 3. POST /api/v1/addresses — Create a new saved delivery address ──
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { fullName, phone, street, addressLine1, landmark, city, state, zip, pincode, country, isDefault } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (phone) {
      const cleanPhoneDigits = String(phone).replace(/[^0-9]/g, '');
      if (cleanPhoneDigits.length < 10 || cleanPhoneDigits.length > 13) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number' });
      }
    }

    if (zip || pincode) {
      const cleanPincode = String(zip || pincode).trim();
      if (!/^[0-9]{5,6}$/.test(cleanPincode)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit pincode' });
      }
    }

    const cleanStreet = [street || addressLine1, landmark].filter(Boolean).join(', ') || street || addressLine1 || 'Main Street';
    const cleanZip = zip || pincode || '600001';
    const cleanPhone = phone || user.phone || '9876543210';
    const cleanFullName = fullName || user.name || 'Customer';
    const cleanCity = city || 'Chennai';
    const cleanState = state || 'Tamil Nadu';
    const cleanCountry = country || 'India';
    const makeDefault = Boolean(isDefault);

    // If setting as default or if this is the user's first address, unset existing defaults
    const existingCount = await prisma.address.count({ where: { userId } });
    const shouldBeDefault = makeDefault || existingCount === 0;

    const result = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const created = await tx.address.create({
        data: {
          userId,
          fullName: cleanFullName,
          phone: cleanPhone,
          street: cleanStreet,
          city: cleanCity,
          state: cleanState,
          zip: cleanZip,
          country: cleanCountry,
          isDefault: shouldBeDefault,
        },
      });

      return created;
    });

    sendSuccess(res, { address: formatAddress(result) }, 'Address saved successfully', 201);
  } catch (err) {
    next(err);
  }
});

// ── 4. PUT /api/v1/addresses/:id — Update existing saved delivery address ──
router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { fullName, phone, street, addressLine1, landmark, city, state, zip, pincode, country, isDefault } = req.body;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (phone) {
      const cleanPhoneDigits = String(phone).replace(/[^0-9]/g, '');
      if (cleanPhoneDigits.length < 10 || cleanPhoneDigits.length > 13) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number' });
      }
    }

    if (zip || pincode) {
      const cleanPincode = String(zip || pincode).trim();
      if (!/^[0-9]{5,6}$/.test(cleanPincode)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit pincode' });
      }
    }

    const cleanStreet = [street || addressLine1, landmark].filter(Boolean).join(', ') || street || addressLine1 || existing.street;
    const cleanZip = zip || pincode || existing.zip;
    const cleanPhone = phone || existing.phone;
    const cleanFullName = fullName || existing.fullName;
    const cleanCity = city || existing.city;
    const cleanState = state || existing.state;
    const cleanCountry = country || existing.country;
    const makeDefault = isDefault !== undefined ? Boolean(isDefault) : existing.isDefault;

    const result = await prisma.$transaction(async (tx) => {
      if (makeDefault && !existing.isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const updated = await tx.address.update({
        where: { id },
        data: {
          fullName: cleanFullName,
          phone: cleanPhone,
          street: cleanStreet,
          city: cleanCity,
          state: cleanState,
          zip: cleanZip,
          country: cleanCountry,
          isDefault: makeDefault,
        },
      });

      return updated;
    });

    sendSuccess(res, { address: formatAddress(result) }, 'Address updated successfully');
  } catch (err) {
    next(err);
  }
});

// ── 5. PUT /api/v1/addresses/:id/default — Set address as default ──
router.put('/:id/default', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await tx.address.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    const updated = await prisma.address.findUnique({ where: { id } });
    sendSuccess(res, { address: formatAddress(updated) }, 'Default address updated successfully');
  } catch (err) {
    next(err);
  }
});

// ── 6. DELETE /api/v1/addresses/:id — Delete a saved address ──
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await prisma.address.delete({ where: { id } });

    // If deleted address was default, make the latest one default
    if (existing.isDefault) {
      const remaining = await prisma.address.findFirst({
        where: { userId },
        orderBy: { id: 'desc' },
      });
      if (remaining) {
        await prisma.address.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    sendSuccess(res, null, 'Address deleted successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
