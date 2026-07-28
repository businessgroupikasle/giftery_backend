import { Router } from 'express';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema } from '../validations/reviewValidation.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

const router = Router();

// GET /api/v1/reviews/product/:productId
router.get('/product/:productId', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    sendSuccess(res, { reviews, averageRating: Math.round(avg * 10) / 10, count: reviews.length });
  } catch (err) { next(err); }
});

// POST /api/v1/reviews/product/:productId
router.post('/product/:productId', authenticate, validate(createReviewSchema), async (req, res, next) => {
  try {
    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: req.user.id, productId: req.params.productId } },
      create: { userId: req.user.id, productId: req.params.productId, ...req.body },
      update: req.body,
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    sendSuccess(res, { review }, 'Review submitted', HTTP_STATUS.CREATED);
  } catch (err) { next(err); }
});

// DELETE /api/v1/reviews/:id
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) return sendSuccess(res, null, 'Review not found');
    if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
      const err = new Error('Access denied');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }
    await prisma.review.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Review deleted');
  } catch (err) { next(err); }
});

export default router;
