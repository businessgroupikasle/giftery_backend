import { Router } from 'express';
import { couponController } from '../controllers/couponController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', couponController.listActive);
router.get('/admin', authenticate, authorize('ADMIN'), couponController.listAdmin);
router.post('/', authenticate, authorize('ADMIN'), couponController.create);
router.put('/:id', authenticate, authorize('ADMIN'), couponController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), couponController.remove);

export default router;
