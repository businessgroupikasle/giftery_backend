import { Router } from 'express';
import { enquiryController } from '../controllers/enquiryController.js';

const router = Router();

// Public contact submission & viewing
router.post('/', enquiryController.createEnquiry);
router.get('/', enquiryController.getAllEnquiries);
router.patch('/:id/status', enquiryController.updateStatus);
router.delete('/:id', enquiryController.deleteEnquiry);

export default router;
