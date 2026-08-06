import { Router } from 'express';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

const router = Router();

router.use(authenticate);

// GET /api/v1/wishlist
router.get('/', async (req, res, next) => {
  try {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { product: { select: { id: true, name: true, slug: true, price: true, images: true } } } } },
    });
    if (!wishlist) wishlist = await prisma.wishlist.create({ data: { userId: req.user.id }, include: { items: true } });
    sendSuccess(res, { wishlist });
  } catch (err) { next(err); }
});

// POST /api/v1/wishlist
router.post('/', async (req, res, next) => {
  try {
    const { productId } = req.body;
    let wishlist = await prisma.wishlist.findUnique({ where: { userId: req.user.id } });
    if (!wishlist) wishlist = await prisma.wishlist.create({ data: { userId: req.user.id } });
    await prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      create: { wishlistId: wishlist.id, productId },
      update: {},
    });
    sendSuccess(res, null, 'Added to wishlist', HTTP_STATUS.CREATED);
  } catch (err) { next(err); }
});

// DELETE /api/v1/wishlist/:productId
router.delete('/:productId', async (req, res, next) => {
  try {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: req.user.id } });
    if (wishlist) {
      await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId: req.params.productId } });
    }
    sendSuccess(res, null, 'Removed from wishlist');
  } catch (err) { next(err); }
});

// DELETE /api/v1/wishlist (Clear all)
router.delete('/', async (req, res, next) => {
  try {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: req.user.id } });
    if (wishlist) {
      await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
    }
    sendSuccess(res, null, 'Wishlist cleared');
  } catch (err) { next(err); }
});

export default router;
