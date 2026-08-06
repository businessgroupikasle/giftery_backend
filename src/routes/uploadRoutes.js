import { Router } from 'express';
import { uploadController } from '../controllers/uploadController.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', upload.single('image'), uploadController.uploadSingle);

export default router;
