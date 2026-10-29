import { getStoreSettings } from '../controllers/settingController.js';
import { resolveCoupon } from '../controllers/couponController.js';

export function calculateOrderPricing(subtotalPaise, couponCode, settings = getStoreSettings(), couponResolver = resolveCoupon) {
  const number = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  const threshold = number(settings.freeShippingThreshold ?? settings.freeShippingMinimum, 999);
  const shipping = number(settings.standardShippingFee ?? settings.shippingFee ?? settings.deliveryCharge, 99);
  const taxPercentage = number(settings.taxPercentage ?? settings.taxRate, 18);
  const coupon = couponCode ? couponResolver(couponCode) : null;
  let discount = 0;
  if (coupon) {
    const value = Number(coupon.discountValue);
    if (!Number.isFinite(value) || value <= 0 || !['percent', 'fixed'].includes(coupon.discountType) || (coupon.discountType === 'percent' && value > 100)) {
      const error = new Error('Invalid coupon configuration'); error.statusCode = 400; throw error;
    }
    discount = Math.min(subtotalPaise, Math.round(coupon.discountType === 'percent' ? subtotalPaise * value / 100 : value * 100));
  }
  const shippingPaise = subtotalPaise > 0 && subtotalPaise < threshold * 100 ? Math.round(shipping * 100) : 0;
  const taxPaise = Math.round((subtotalPaise - discount) * taxPercentage / 100);
  const totalPaise = subtotalPaise - discount + shippingPaise + taxPaise;
  if (!Number.isSafeInteger(totalPaise)) { const error = new Error('Invalid pricing configuration'); error.statusCode = 400; throw error; }
  return { subtotal: subtotalPaise / 100, discountAmount: discount / 100, shippingFee: shippingPaise / 100, taxPercentage, taxAmount: taxPaise / 100, totalAmount: totalPaise / 100, couponCode: coupon?.code || null };
}
