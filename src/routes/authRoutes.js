import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validations/authValidation.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login',    authLimiter, validate(loginSchema),    authController.login);
router.post('/logout',   authenticate,                          authController.logout);
router.get('/me',        authenticate,                          authController.getMe);
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
