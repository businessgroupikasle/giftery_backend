import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '../validations/productValidation.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/stats', dashboardController.getStats);
router.get('/products/stats', dashboardController.getProductStats);

router.get('/products', dashboardController.getProducts);
router.get('/products/stock/low', dashboardController.getLowStockProducts);
router.get('/products/stock/outofstock', dashboardController.getOutOfStockProducts);
router.get('/products/top-selling', dashboardController.getTopSellingProducts);
router.get('/products/status/:status', dashboardController.getProductsByStatus);
router.get('/products/:id', dashboardController.getProductById);

router.post('/products', validate(createProductSchema), dashboardController.createProduct);
router.post('/products/:id/clone', dashboardController.cloneProduct);

router.put('/products/:id', validate(updateProductSchema), dashboardController.updateProduct);
router.patch('/products/:id/status', dashboardController.updateProductStatus);
router.patch('/products/:id/inventory', dashboardController.updateInventory);

router.post('/products/batch/delete', dashboardController.bulkDelete);
router.patch('/products/batch/status', dashboardController.bulkUpdateStatus);

router.delete('/products/:id', dashboardController.deleteProduct);

export default router;
