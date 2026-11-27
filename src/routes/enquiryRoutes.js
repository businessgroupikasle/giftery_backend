import { Router } from 'express';
import { enquiryController } from '../controllers/enquiryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { inquiryLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { bulkOrderInquirySchema, bulkOrderListQuerySchema, bulkOrderStatusSchema } from '../validations/enquiryValidation.js';

const router = Router();
const adminOnly = [authenticate, authorize('ADMIN')];

// Public: contact form and bulk order inquiry submissions
// Quote and catalogue enquiries send emails, so this public form is rate limited like the bulk form.
router.post('/', inquiryLimiter, enquiryController.createEnquiry);
router.post('/bulk-order', inquiryLimiter, validate(bulkOrderInquirySchema), enquiryController.createBulkOrderInquiry);

// Admin: bulk order inquiries (registered before /:id routes)
router.get('/bulk-orders', ...adminOnly, validate(bulkOrderListQuerySchema, 'query'), enquiryController.listBulkOrders);
router.patch('/bulk-orders/:id/status', ...adminOnly, validate(bulkOrderStatusSchema), enquiryController.updateBulkOrderStatus);

// Admin: customer enquiries hold names, emails and phone numbers, so only staff may read or change them
router.get('/', ...adminOnly, enquiryController.getAllEnquiries);
router.patch('/:id/status', ...adminOnly, enquiryController.updateStatus);
router.delete('/:id', ...adminOnly, enquiryController.deleteEnquiry);

export default router;
