import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema } from '../validations/orderValidation.js';
import { checkMaintenanceMode } from '../middleware/maintenance.js';

// The webhook (POST /razorpay/webhook) is mounted in app.js: it needs the raw body and no login.
const router = Router();
router.use(authenticate);

// Step 1: price the checkout and open a Razorpay order. No store order is created here.
router.post('/razorpay/create-order', checkMaintenanceMode, validate(createOrderSchema), paymentController.createRazorpayOrder);

// Step 2: verify the payment; the store order is created only now.
router.post('/razorpay/verify-payment', paymentController.verifyRazorpayPayment);

export default router;
