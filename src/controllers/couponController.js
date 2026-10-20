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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const todayString = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Dates are plain YYYY-MM-DD strings; the expiry date itself is still valid
const getValidity = (coupon) => {
  const today = todayString();
  if (coupon.expiryDate && today > coupon.expiryDate) return 'Expired';
  if (coupon.startDate && today < coupon.startDate) return 'Upcoming';
  return 'Valid';
};

const withValidity = (coupon) => ({ ...coupon, validity: getValidity(coupon) });

const readOptionalDate = (value, fallback) => {
  const raw = value === undefined ? fallback : value;
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const text = String(raw).trim();
  if (!DATE_ONLY.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) return { error: true };
  return { value: text };
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

  const startDate = readOptionalDate(body.startDate, existing.startDate);
  if (startDate.error) return { error: 'Start date must be a valid date (YYYY-MM-DD)' };
  const expiryDate = readOptionalDate(body.expiryDate, existing.expiryDate);
  if (expiryDate.error) return { error: 'Expiry date must be a valid date (YYYY-MM-DD)' };
  if (startDate.value && expiryDate.value && expiryDate.value < startDate.value) {
    return { error: 'Expiry date cannot be before the start date' };
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
      startDate: startDate.value,
      expiryDate: expiryDate.value,
      source: 'admin',
    },
  };
};

export const couponController = {
  listActive: (req, res) => {
    const coupons = readCoupons()
      .filter((coupon) => coupon.status === 'Active' && getValidity(coupon) === 'Valid')
      .map(withValidity);
    sendSuccess(res, coupons, 'Active coupons retrieved');
  },

  // Checkout check: unknown codes are 404, inactive ones are rejected, only active coupons are returned
  validate: (req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    if (!code) return sendError(res, 'Please enter a coupon code', 400);

    const coupon = readCoupons().find((item) => item.code === code);
    if (!coupon) return sendError(res, `Invalid coupon code "${code}"`, 404);
    if (coupon.status !== 'Active') {
      return sendError(res, 'This coupon is inactive and cannot be applied.', 400);
    }
    const validity = getValidity(coupon);
    if (validity === 'Expired') {
      return sendError(res, 'This coupon has expired and cannot be applied.', 400);
    }
    if (validity === 'Upcoming') {
      return sendError(res, `This coupon is not valid yet. It starts on ${coupon.startDate}.`, 400);
    }
    sendSuccess(res, withValidity(coupon), 'Coupon is valid');
  },

  listAdmin: (req, res) => {
    sendSuccess(res, readCoupons().map(withValidity), 'Coupons retrieved');
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
    sendSuccess(res, withValidity(coupon), 'Coupon created successfully', 201);
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
    sendSuccess(res, withValidity(coupons[index]), 'Coupon updated successfully');
  },

  remove: (req, res) => {
    const coupons = readCoupons();
    const updated = coupons.filter((coupon) => coupon.id !== req.params.id);
    if (updated.length === coupons.length) return sendError(res, 'Coupon not found', 404);
    writeCoupons(updated);
    sendSuccess(res, null, 'Coupon permanently deleted');
  },
};
