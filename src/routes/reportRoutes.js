import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, authorize('ADMIN'), reportController.getSummary);

export default router;
