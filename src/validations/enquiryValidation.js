import { z } from 'zod';
import { BULK_ORDER_STATUSES } from '../services/bulkInquiryService.js';

/* Bulk orders (and the 10% bulk offer) start at this many units. */
export const BULK_ORDER_MIN_QUANTITY = 100;
export const BULK_ORDER_MAX_QUANTITY = 1_000_000;

const requiredText = (label, min, max) => z
  .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
  .trim()
  .min(min, min > 1 ? `${label} must be at least ${min} characters` : `${label} is required`)
  .max(max, `${label} must be at most ${max} characters`);

const optionalText = (label, max) => z
  .string({ invalid_type_error: `${label} must be text` })
  .trim()
  .max(max, `${label} must be at most ${max} characters`)
  .optional()
  .transform((value) => value || null);

/**
 * Bulk order inquiry from the product details page.
 * Only the product ID is taken from the client: the product name and SKU are read
 * from the database, so any name/SKU fields in the request are stripped here.
 */
export const bulkOrderInquirySchema = z.object({
  productId: requiredText('Product', 1, 64),
  quantity: z.preprocess(
    (value) => (typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value),
    z.number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a whole number' })
      .int('Quantity must be a whole number')
      .min(BULK_ORDER_MIN_QUANTITY, `Minimum bulk order quantity is ${BULK_ORDER_MIN_QUANTITY} units`)
      .max(BULK_ORDER_MAX_QUANTITY, `Quantity must be at most ${BULK_ORDER_MAX_QUANTITY.toLocaleString('en-IN')}`)
  ),
  name: requiredText('Full name', 2, 100),
  email: requiredText('Email address', 1, 254)
    .email('Please enter a valid email address')
    .transform((value) => value.toLowerCase()),
  // Format is checked by normalizeContactPhone in the service, like the contact form.
  phone: requiredText('Phone number', 1, 32),
  company: optionalText('Company name', 150),
  requirements: optionalText('Additional requirements', 2000),
});

/** Admin list query for GET /enquiries/bulk-orders. */
export const bulkOrderListQuerySchema = z.object({
  status: z.enum(BULK_ORDER_STATUSES).optional(),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Admin status change for PATCH /enquiries/bulk-orders/:id/status. */
export const bulkOrderStatusSchema = z.object({
  status: z.enum(BULK_ORDER_STATUSES, { errorMap: () => ({ message: `Status must be one of: ${BULK_ORDER_STATUSES.join(', ')}` }) }),
});
