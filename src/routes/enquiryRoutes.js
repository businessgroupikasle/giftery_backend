import { Router } from 'express';
import { enquiryController } from '../controllers/enquiryController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public contact submission
router.post('/', enquiryController.createEnquiry);

// Admin / Super Admin view & update
router.get('/', authenticate, authorize('ADMIN'), enquiryController.getAllEnquiries);
router.patch('/:id/status', authenticate, authorize('ADMIN'), enquiryController.updateStatus);

export default router;
