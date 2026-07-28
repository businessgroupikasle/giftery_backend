import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description too short').max(5000),
  price: z.number().positive('Price must be positive'),
  comparePrice: z.number().positive().optional(),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  images: z.array(z.string().url()).min(1, 'At least one image required'),
  sku: z.string().optional(),
  weight: z.number().positive().optional(),
  featured: z.boolean().optional().default(false),
  categoryId: z.string().min(1, 'Category is required'),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('12'),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'rating', 'featured']).optional().default('newest'),
  featured: z.string().optional(),
});
