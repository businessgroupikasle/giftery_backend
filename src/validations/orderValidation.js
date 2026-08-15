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
  shippingAddress: shippingAddressSchema.or(z.any()),
  items: z.array(z.any()).optional(),
  totalAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().max(500).optional(),
}).passthrough();

export const updateOrderStatusSchema = z.object({
  status: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
    z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  ),
});
