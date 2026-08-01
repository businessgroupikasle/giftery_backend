import { Router } from 'express';
import { catalogController } from '../controllers/catalogController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/collections', authenticate, authorize('ADMIN'), catalogController.getCollections);
router.get('/brands', authenticate, authorize('ADMIN'), catalogController.getBrands);
router.get('/attributes', authenticate, authorize('ADMIN'), catalogController.getAttributes);
router.get('/inventory', authenticate, authorize('ADMIN'), catalogController.getInventory);

export default router;
