import { z } from 'zod';

const shippingAddressSchema = z.object({
  fullName: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  addressLine1: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
}).passthrough();

export const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  items: z.array(z.object({ productId: z.string().min(1).optional(), id: z.string().min(1).optional(), quantity: z.number().int().min(1).max(10000), customization: z.record(z.any()).nullable().optional() }).refine((item) => item.productId || item.id)).min(1).max(100).optional(),
  totalAmount: z.number().optional(),
  expectedTotal: z.number().finite().nonnegative().optional(),
  couponCode: z.string().trim().max(16).nullable().optional(),
  paymentMethod: z.preprocess((value) => typeof value === 'string' ? value.toUpperCase() : value, z.enum(['COD', 'RAZORPAY']).default('COD')),
  notes: z.string().max(500).optional(),
}).passthrough().refine((body) => body.expectedTotal !== undefined || body.totalAmount !== undefined, { message: 'Expected total is required', path: ['expectedTotal'] });

export const updateOrderStatusSchema = z.object({
  status: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
    z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  ),
});
