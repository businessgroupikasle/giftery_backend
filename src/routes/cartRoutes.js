import { Router } from 'express';
import { cartController } from '../controllers/cartController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addToCartSchema, updateCartItemSchema } from '../validations/cartValidation.js';

const router = Router();

router.use(authenticate);

router.get('/',                                           cartController.getCart);
router.post('/',        validate(addToCartSchema),        cartController.addItem);
router.put('/:itemId',  validate(updateCartItemSchema),   cartController.updateItem);
router.delete('/:itemId',                                 cartController.removeItem);
router.delete('/',                                        cartController.clearCart);

export default router;
