import { Router } from 'express';
import { corporateController } from '../controllers/corporateController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/orders', authenticate, authorize('ADMIN'), corporateController.getOrders);
router.get('/quotes', authenticate, authorize('ADMIN'), corporateController.getQuotes);
router.get('/artwork', authenticate, authorize('ADMIN'), corporateController.getArtworks);

export default router;
