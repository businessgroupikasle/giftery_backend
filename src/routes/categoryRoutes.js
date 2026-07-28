import { Router } from 'express';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// GET /api/v1/categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, { categories });
  } catch (err) { next(err); }
});

// GET /api/v1/categories/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: { children: true, _count: { select: { products: true } } },
    });
    if (!category) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }
    sendSuccess(res, { category });
  } catch (err) { next(err); }
});

export default router;
