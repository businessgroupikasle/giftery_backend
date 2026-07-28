import { z } from 'zod';

const shippingAddressSchema = z.object({
  fullName: z.string().min(2),
  street: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().min(3),
  country: z.string().default('US'),
  phone: z.string().min(7),
});

export const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
});
