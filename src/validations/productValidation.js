import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  description: z.string().min(1, 'Description required').max(10000),
  price: z.number().min(0, 'Price must be 0 or positive'),
  comparePrice: z.number().optional().nullable(),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  images: z.array(z.string()).optional().default([]),
  sku: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
  featured: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  isBestseller: z.boolean().optional().default(false),
  isPopular: z.boolean().optional().default(false),
  isNewArrival: z.boolean().optional().default(false),
  isMostLoved: z.boolean().optional().default(false),
  isGiftSet: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  categoryId: z.string().min(1, 'Category is required'),
  subCategoryId: z.string().optional().nullable(),
  specifications: z.string().optional().nullable(),
  customization: z.string().optional().nullable(),
  shippingReturns: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  rating: z.number().optional().default(4.8),
  reviewsCount: z.number().optional().default(128),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('12'),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'rating', 'featured']).optional().default('newest'),
  featured: z.string().optional(),
  showAll: z.string().optional(),
});
