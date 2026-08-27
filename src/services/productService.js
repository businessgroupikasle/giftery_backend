import { productRepository } from '../repositories/productRepository.js';
import { paginate } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { fileUploadHelper } from '../helpers/fileUpload.js';
import prisma from '../config/db.js';

const sortMap = {
  price_asc: [{ price: 'asc' }, { id: 'desc' }],
  price_desc: [{ price: 'desc' }, { id: 'desc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  rating: [{ rating: 'desc' }, { id: 'desc' }],
  featured: [{ featured: 'desc' }, { id: 'desc' }],
};

const sanitizeProductData = (inputData = {}) => {
  const data = { ...inputData };

  // Map isFeatured -> featured
  if (data.isFeatured !== undefined) {
    data.featured = Boolean(data.isFeatured || data.featured);
    delete data.isFeatured;
  }
  if (data.featured !== undefined) {
    data.featured = Boolean(data.featured);
  }
  if (data.isBestseller !== undefined) {
    data.isBestseller = Boolean(data.isBestseller);
  }
  if (data.isPopular !== undefined) {
    data.isPopular = Boolean(data.isPopular);
  }
  if (data.isNewArrival !== undefined) {
    data.isNewArrival = Boolean(data.isNewArrival);
  }
  if (data.isMostLoved !== undefined) {
    data.isMostLoved = Boolean(data.isMostLoved);
  }
  if (data.isGiftSet !== undefined) {
    data.isGiftSet = Boolean(data.isGiftSet);
  }

  if (data.price !== undefined) data.price = parseFloat(data.price);
  if (data.comparePrice !== undefined) {
    data.comparePrice = data.comparePrice !== null && data.comparePrice !== '' ? parseFloat(data.comparePrice) : null;
  }
  if (data.stock !== undefined) data.stock = parseInt(data.stock, 10) || 0;
  if (data.rating !== undefined) data.rating = parseFloat(data.rating) || 4.8;
  if (data.reviewsCount !== undefined) data.reviewsCount = parseInt(data.reviewsCount, 10) || 0;
  if (data.weight !== undefined) {
    data.weight = data.weight !== null && data.weight !== '' ? parseFloat(data.weight) : null;
  }

  if (data.images && !Array.isArray(data.images)) {
    if (typeof data.images === 'string') {
      data.images = data.images.includes('|||')
        ? data.images.split('|||').map(s => s.trim()).filter(Boolean)
        : data.images.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      data.images = [];
    }
  }

  if (data.tags && !Array.isArray(data.tags)) {
    if (typeof data.tags === 'string') {
      data.tags = data.tags.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      data.tags = [];
    }
  }

  // Remove any virtual or joined fields not in Prisma Product schema
  delete data.id;
  delete data.category;
  delete data.categoryName;
  delete data.categorySlug;
  delete data.subCategory;
  delete data.subCategoryName;
  delete data.subCategorySlug;
  delete data._count;
  delete data.reviews;
  delete data.createdAt;
  delete data.updatedAt;

  // Clean empty strings for optional relation/string fields
  if (data.subCategoryId !== undefined) {
    data.subCategoryId = data.subCategoryId ? String(data.subCategoryId).trim() : null;
  }
  if (!data.sku) delete data.sku;
  if (data.specifications && typeof data.specifications === 'object') {
    data.specifications = JSON.stringify(data.specifications);
  }

  return data;
};

export const productService = {
  getAll: async (query) => {
    const { page, limit, search, categoryId, subCategoryId, minPrice, maxPrice, sort, featured, showAll } = query;

    const andConditions = [];

    if (showAll !== 'true') {
      andConditions.push({ isActive: true });
    }

    if (search && search.trim()) {
      andConditions.push({
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { description: { contains: search.trim(), mode: 'insensitive' } },
          { sku: { contains: search.trim(), mode: 'insensitive' } },
        ]
      });
    }

    if (subCategoryId && subCategoryId !== 'all') {
      andConditions.push({
        OR: [
          { subCategoryId: subCategoryId },
          { categoryId: subCategoryId },
        ]
      });
    } else if (categoryId && categoryId !== 'all' && categoryId !== 'unassigned') {
      andConditions.push({
        OR: [
          { categoryId: categoryId },
          { subCategoryId: categoryId },
          { category: { parentId: categoryId } },
        ]
      });
    }

    if (featured !== undefined) {
      andConditions.push({ featured: featured === 'true' });
    }

    if (minPrice || maxPrice) {
      andConditions.push({
        price: {
          ...(minPrice && { gte: parseFloat(minPrice) }),
          ...(maxPrice && { lte: parseFloat(maxPrice) }),
        }
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const total = await productRepository.count(where);
    const meta = paginate(page, limit, total);
    const data = await productRepository.findMany({
      skip: meta.skip,
      take: meta.take,
      where,
      orderBy: sortMap[sort] || sortMap.newest,
    });

    return { data, meta };
  },

  getBySlug: async (slug) => {
    let product = await productRepository.findBySlug(slug);
    if (!product) {
      // Fallback check by ID
      product = await productRepository.findById(slug);
    }
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }
    return product;
  },

  create: async (rawInput) => {
    const data = sanitizeProductData(rawInput);
    const slug = slugify(data.name || 'product');
    const existing = await productRepository.existsBySlug(slug);
    data.slug = existing ? `${slug}-${Date.now()}` : slug;

    // Validate categoryId
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
    } else {
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

    // Validate subCategoryId if present
    if (data.subCategoryId) {
      const subExists = await prisma.category.findUnique({ where: { id: data.subCategoryId } });
      if (!subExists) {
        data.subCategoryId = null;
      }
    } else {
      data.subCategoryId = null;
    }

    return productRepository.create(data);
  },

  update: async (id, rawInput) => {
    let product = await productRepository.findById(id);
    if (!product) {
      // Check by slug if id not found
      product = await productRepository.findBySlug(id);
    }
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const data = sanitizeProductData(rawInput);
    const targetId = product.id;

    if (data.name && data.name !== product.name) {
      const newSlug = slugify(data.name);
      const existing = await productRepository.existsBySlug(newSlug, targetId);
      data.slug = existing ? `${newSlug}-${Date.now()}` : newSlug;
    }
    if (data.categoryId) {
      const catExists = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!catExists) {
        delete data.categoryId;
      }
    }
    if (data.subCategoryId !== undefined) {
      if (data.subCategoryId) {
        const subExists = await prisma.category.findUnique({ where: { id: data.subCategoryId } });
        if (!subExists) {
          data.subCategoryId = null;
        }
      } else {
        data.subCategoryId = null;
      }
    }
    return productRepository.update(targetId, data);
  },

  delete: async (id) => {
    let product = await productRepository.findById(id);
    if (!product) {
      product = await productRepository.findBySlug(id);
    }
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const deleteResult = await productRepository.delete(product.id);

    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const cleanupResult = fileUploadHelper.deleteImagesByUrls(product.images);
      if (cleanupResult.failed.length > 0) {
        console.warn(`Failed to delete ${cleanupResult.failed.length} images for product ${product.id}:`, cleanupResult.failed);
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
    return productService.update(id, data);
  },
};
