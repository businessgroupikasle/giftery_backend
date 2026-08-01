import { Router } from 'express';
import { cmsController } from '../controllers/cmsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/pages', authenticate, authorize('ADMIN'), cmsController.getPages);
router.get('/media', authenticate, authorize('ADMIN'), cmsController.getMedia);

export default router;
