import { Router } from 'express';
import { orderController } from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema, updateOrderStatusSchema } from '../validations/orderValidation.js';

const router = Router();

router.use(authenticate);

router.get('/my',   orderController.getMyOrders);
router.get('/',     authorize('ADMIN'), orderController.getAllOrders);
router.get('/:id',  orderController.getById);
router.post('/',    validate(createOrderSchema), orderController.createOrder);
router.patch('/:id/status', authorize('ADMIN'), validate(updateOrderStatusSchema), orderController.updateStatus);
router.put('/:id/status',   authorize('ADMIN'), validate(updateOrderStatusSchema), orderController.updateStatus);
router.put('/:id',          authorize('ADMIN'), validate(updateOrderStatusSchema), orderController.updateStatus);

export default router;
