import { Router } from 'express';
import { settingController } from '../controllers/settingController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', settingController.getSettings);
router.put('/', authenticate, authorize('ADMIN'), settingController.updateSettings);

export default router;
