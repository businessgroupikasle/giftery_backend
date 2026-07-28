import { Router } from 'express';
import authRoutes     from './authRoutes.js';
import productRoutes  from './productRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import cartRoutes     from './cartRoutes.js';
import orderRoutes    from './orderRoutes.js';
import wishlistRoutes from './wishlistRoutes.js';
import reviewRoutes   from './reviewRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth',       authRoutes);
router.use('/products',   productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart',       cartRoutes);
router.use('/orders',     orderRoutes);
router.use('/wishlist',   wishlistRoutes);
router.use('/reviews',    reviewRoutes);
router.use('/dashboard',  dashboardRoutes);

export default router;
