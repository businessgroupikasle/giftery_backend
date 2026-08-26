import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, verifyResetOtpSchema, resendResetOtpSchema, resetPasswordSchema } from '../validations/authValidation.js';

const router = Router();

router.post('/request-otp',       authLimiter,                                  authController.requestOTP);
router.post('/register',          authLimiter, validate(registerSchema),        authController.register);
router.post('/verify-email',      authLimiter,                                  authController.verifyEmail);
router.post('/resend-otp',        authLimiter,                                  authController.resendOTP);
router.post('/login',             authLimiter, validate(loginSchema),           authController.login);
router.post('/forgot-password',   authLimiter, validate(forgotPasswordSchema),   authController.forgotPassword);
router.post('/verify-reset-otp',  authLimiter, validate(verifyResetOtpSchema),  authController.verifyResetOTP);
router.post('/resend-reset-otp',  authLimiter, validate(resendResetOtpSchema),  authController.resendResetOTP);
router.post('/reset-password',    authLimiter, validate(resetPasswordSchema),    authController.resetPassword);
router.post('/logout',            authenticate,                                 authController.logout);
router.get('/me',                 authenticate,                                 authController.getMe);
router.put('/change-password',    authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
