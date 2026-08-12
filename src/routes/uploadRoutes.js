import { Router } from 'express';
import { uploadController } from '../controllers/uploadController.js';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/', upload.single('image'), uploadController.uploadSingle);
router.post('/multiple', authenticate, upload.array('images', 10), uploadController.uploadMultiple);
router.delete('/:filename', authenticate, uploadController.deleteFile);
router.post('/batch/delete', authenticate, uploadController.deleteMultiple);
router.get('/validate/:url', authenticate, uploadController.validateUrl);

export default router;
