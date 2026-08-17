import { Router } from 'express';
import { productController } from '../controllers/productController.js';
import { bulkImportController } from '../controllers/bulkImportController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadExcel } from '../middleware/upload.js';
import { createProductSchema, updateProductSchema, productQuerySchema } from '../validations/productValidation.js';

const router = Router();

// Bulk Product Import Routes (defined before /:slug)
router.get('/bulk/template', bulkImportController.downloadTemplate);
router.post('/bulk/validate', authenticate, authorize('ADMIN', 'VENDOR'), uploadExcel.single('file'), bulkImportController.validateExcel);
router.post('/bulk/import',   authenticate, authorize('ADMIN', 'VENDOR'), bulkImportController.confirmImport);

// Standard Product Routes
router.get('/',      validate(productQuerySchema, 'query'), productController.getAll);
router.get('/:slug',                                         productController.getBySlug);
router.post('/',   authenticate, authorize('ADMIN', 'VENDOR'), validate(createProductSchema), productController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'VENDOR'), validate(updateProductSchema), productController.update);
router.delete('/:id', authenticate, authorize('ADMIN'),       productController.delete);

export default router;
