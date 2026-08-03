import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';

const router = Router();

// Create Razorpay Order
router.post('/razorpay/create-order', paymentController.createRazorpayOrder);

// Verify Razorpay Payment Signature
router.post('/razorpay/verify-payment', paymentController.verifyRazorpayPayment);

export default router;
