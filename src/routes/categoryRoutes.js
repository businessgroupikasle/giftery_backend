import { Router } from 'express';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { slugify } from '../utils/slugify.js';

const router = Router();

// GET /api/v1/categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, { categories });
  } catch (err) { next(err); }
});

// POST /api/v1/categories
router.post('/', async (req, res, next) => {
  try {
    const { name, description, image, sortOrder, isActive, parentId } = req.body;
    if (!name) {
      const err = new Error('Category name is required');
      err.statusCode = 400;
      throw err;
    }
    const slug = slugify(name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        description: description || null,
        image: image || null,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) || 0 : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        parentId: parentId || null,
      },
      include: { _count: { select: { products: true } } },
    });
    sendSuccess(res, { category }, 'Category created successfully', 201);
  } catch (err) { next(err); }
});

// PUT /api/v1/categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, image, sortOrder, isActive, parentId } = req.body;
    const { id } = req.params;

    const updateData = {};
    if (name) {
      updateData.name = name;
      const slug = slugify(name);
      const existing = await prisma.category.findFirst({ where: { slug, NOT: { id } } });
      updateData.slug = existing ? `${slug}-${Date.now()}` : slug;
    }
    if (description !== undefined) updateData.description = description || null;
    if (image !== undefined) updateData.image = image || null;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (parentId !== undefined) updateData.parentId = parentId || null;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { products: true } } },
    });
    sendSuccess(res, { category }, 'Category updated successfully');
  } catch (err) { next(err); }
});

// DELETE /api/v1/categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    sendSuccess(res, null, 'Category deleted successfully');
  } catch (err) { next(err); }
});

export default router;
