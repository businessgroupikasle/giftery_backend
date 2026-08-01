import { Router } from 'express';
import { uploadController } from '../controllers/uploadController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, authorize('ADMIN'), uploadController.uploadSingle);

export default router;
