import { z } from 'zod';

export const updateProductStatusSchema = z.object({
  isActive: z.boolean(),
});

export const inventoryUpdateSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
});

export const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one product ID required'),
  isActive: z.boolean(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one product ID required'),
});

export const dashboardProductQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  stock: z.enum(['low', 'outofstock']).optional(),
  sort: z.enum(['newest', 'oldest', 'name_asc', 'name_desc', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc']).optional().default('newest'),
});

export const topSellingProductsQuerySchema = z.object({
  days: z.string().default('30'),
  limit: z.string().default('10'),
});

export const lowStockProductsQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  threshold: z.string().default('10'),
});

export const productStatusQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  status: z.enum(['active', 'inactive']),
});
