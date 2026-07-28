import { productService } from '../services/productService.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export const productController = {
  getAll: async (req, res, next) => {
    try {
      const result = await productService.getAll(req.query);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  getBySlug: async (req, res, next) => {
    try {
      const product = await productService.getBySlug(req.params.slug);
      sendSuccess(res, { product });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const product = await productService.create(req.body);
      sendSuccess(res, { product }, 'Product created', HTTP_STATUS.CREATED);
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const product = await productService.update(req.params.id, req.body);
      sendSuccess(res, { product }, 'Product updated');
    } catch (err) { next(err); }
  },

  delete: async (req, res, next) => {
    try {
      await productService.delete(req.params.id);
      sendSuccess(res, null, 'Product deleted');
    } catch (err) { next(err); }
  },
};
