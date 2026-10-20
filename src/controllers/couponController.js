import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { sendError, sendSuccess } from '../utils/response.js';

const couponsFile = () => {
  const baseDir = path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
  return path.join(baseDir, 'admin_coupons.json');
};

const readCoupons = () => {
  try {
    const file = couponsFile();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCoupons = (coupons) => {
  const file = couponsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(coupons, null, 2), 'utf8');
  fs.renameSync(temporaryFile, file);
};

const normalizeCoupon = (body, existing = {}) => {
  const code = String(body.code ?? existing.code ?? '').trim().toUpperCase();
  const discountType = String(body.discountType ?? existing.discountType ?? '').toLowerCase();
  const discountValue = Number(body.discountValue ?? existing.discountValue);
  const status = String(body.status ?? existing.status ?? 'Active');

  if (!/^(?=.*[A-Z])[A-Z0-9_-]{3,16}$/.test(code)) {
    return { error: 'Coupon code must be 3-16 characters and contain at least one letter' };
  }
  if (!['percent', 'fixed'].includes(discountType)) {
    return { error: 'Discount type must be percent or fixed' };
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) {
    return { error: 'Invalid discount value' };
  }
  if (!['Active', 'Inactive'].includes(status)) {
    return { error: 'Status must be Active or Inactive' };
  }

  const cleanValue = Number(discountValue.toFixed(2));
  return {
    value: {
      ...existing,
      code,
      discountType,
      discountValue: cleanValue,
      discount: discountType === 'percent' ? `${cleanValue}% OFF` : `₹${cleanValue.toLocaleString('en-IN')} OFF`,
      category: String(body.category ?? existing.category ?? 'All Products').trim() || 'All Products',
      status,
      source: 'admin',
    },
  };
};

export const couponController = {
  listActive: (req, res) => {
    const coupons = readCoupons().filter((coupon) => coupon.status === 'Active');
    sendSuccess(res, coupons, 'Active coupons retrieved');
  },

  listAdmin: (req, res) => {
    sendSuccess(res, readCoupons(), 'Coupons retrieved');
  },

  create: (req, res) => {
    const coupons = readCoupons();
    const normalized = normalizeCoupon(req.body);
    if (normalized.error) return sendError(res, normalized.error, 400);
    if (coupons.some((coupon) => coupon.code === normalized.value.code)) {
      return sendError(res, 'Coupon code already exists', 409);
    }

    const coupon = {
      id: crypto.randomUUID(),
      ...normalized.value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeCoupons([coupon, ...coupons]);
    sendSuccess(res, coupon, 'Coupon created successfully', 201);
  },

  update: (req, res) => {
    const coupons = readCoupons();
    const index = coupons.findIndex((coupon) => coupon.id === req.params.id);
    if (index === -1) return sendError(res, 'Coupon not found', 404);

    const normalized = normalizeCoupon(req.body, coupons[index]);
    if (normalized.error) return sendError(res, normalized.error, 400);
    if (coupons.some((coupon, couponIndex) => couponIndex !== index && coupon.code === normalized.value.code)) {
      return sendError(res, 'Coupon code already exists', 409);
    }

    coupons[index] = { ...normalized.value, updatedAt: new Date().toISOString() };
    writeCoupons(coupons);
    sendSuccess(res, coupons[index], 'Coupon updated successfully');
  },

  remove: (req, res) => {
    const coupons = readCoupons();
    const updated = coupons.filter((coupon) => coupon.id !== req.params.id);
    if (updated.length === coupons.length) return sendError(res, 'Coupon not found', 404);
    writeCoupons(updated);
    sendSuccess(res, null, 'Coupon permanently deleted');
  },
};
