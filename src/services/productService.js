import { productRepository } from '../repositories/productRepository.js';
import { paginate } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { fileUploadHelper } from '../helpers/fileUpload.js';
import prisma from '../config/db.js';

const sortMap = {
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  newest: { createdAt: 'desc' },
  rating: { reviews: { _count: 'desc' } },
  featured: { featured: 'desc' },
};

export const productService = {
  getAll: async (query) => {
    const { page, limit, search, categoryId, minPrice, maxPrice, sort, featured, showAll } = query;

    const where = {
      ...(showAll !== 'true' && { isActive: true }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(categoryId && { categoryId }),
      ...(featured !== undefined && { featured: featured === 'true' }),
      ...((minPrice || maxPrice) && {
        price: {
          ...(minPrice && { gte: parseFloat(minPrice) }),
          ...(maxPrice && { lte: parseFloat(maxPrice) }),
        },
      }),
    };

    const total = await productRepository.count(where);
    const meta = paginate(page, limit, total);
    const data = await productRepository.findMany({ skip: meta.skip, take: meta.take, where, orderBy: sortMap[sort] || sortMap.newest });

    return { data, meta };
  },

  getBySlug: async (slug) => {
    const product = await productRepository.findBySlug(slug);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    return product;
  },

  create: async (data) => {
    const slug = slugify(data.name);
    const existing = await productRepository.existsBySlug(slug);
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    if (data.categoryId) {
      const catExists = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!catExists) {
        const fallbackCat = await prisma.category.findFirst();
        if (fallbackCat) {
          data.categoryId = fallbackCat.id;
        } else {
          const newCat = await prisma.category.create({
            data: { name: 'General Gifts', slug: 'general-gifts', description: 'General Store Gifts' }
          });
          data.categoryId = newCat.id;
        }
      }
    }

    return productRepository.create({ ...data, slug: finalSlug });
  },

  update: async (id, data) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    if (data.name) {
      const newSlug = slugify(data.name);
      const existing = await productRepository.existsBySlug(newSlug, id);
      data.slug = existing ? `${newSlug}-${Date.now()}` : newSlug;
    }
    if (data.categoryId) {
      const catExists = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!catExists) {
        delete data.categoryId;
      }
    }
    return productRepository.update(id, data);
  },

  delete: async (id) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const deleteResult = await productRepository.delete(id);

    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const cleanupResult = fileUploadHelper.deleteImagesByUrls(product.images);
      if (cleanupResult.failed.length > 0) {
        console.warn(`Failed to delete ${cleanupResult.failed.length} images for product ${id}:`, cleanupResult.failed);
      }
    }

    return deleteResult;
  },

  validateImages: async (imageUrls = []) => {
    if (!Array.isArray(imageUrls)) return false;
    if (imageUrls.length === 0) return false;
    return imageUrls.every(url => fileUploadHelper.validateImageUrl(url));
  },

  updateWithImages: async (id, data) => {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const isValid = await productService.validateImages(data.images);
      if (!isValid) {
        const err = new Error('One or more image URLs are invalid or files do not exist');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }

      const oldImages = product.images || [];
      const newImages = data.images || [];
      const imagesToDelete = oldImages.filter(img => !newImages.includes(img));

      if (imagesToDelete.length > 0) {
        const cleanupResult = fileUploadHelper.deleteImagesByUrls(imagesToDelete);
        if (cleanupResult.failed.length > 0) {
          console.warn(`Failed to delete ${cleanupResult.failed.length} old images:`, cleanupResult.failed);
        }
      }
    }

    return productService.update(id, data);
  },
};
