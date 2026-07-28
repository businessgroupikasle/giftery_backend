import { Router } from 'express';
import { productController } from '../controllers/productController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema, productQuerySchema } from '../validations/productValidation.js';

const router = Router();

router.get('/',      validate(productQuerySchema, 'query'), productController.getAll);
router.get('/:slug',                                         productController.getBySlug);
router.post('/',   authenticate, authorize('ADMIN', 'VENDOR'), validate(createProductSchema), productController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'VENDOR'), validate(updateProductSchema), productController.update);
router.delete('/:id', authenticate, authorize('ADMIN'),       productController.delete);

export default router;
