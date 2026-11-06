import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer').default(1),
  customizationId: z.string().min(1).max(100).optional(),
  // Customized lines are built on the server from a saved design, never from client JSON.
  customization: z.undefined({ invalid_type_error: 'Save your design before adding it to the cart' }),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
});
