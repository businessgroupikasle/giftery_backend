import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { validateCustomization, canReadArtwork } from '../services/customizationService.js';
import { storeArtwork, readArtwork } from '../services/artworkStorage.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
router.use(authenticate);

router.post('/assets', upload.single('image'), async (req, res) => {
  if (!req.file) return sendError(res, 'Image is required', 400);
  let metadata;
  try {
    metadata = await sharp(req.file.buffer, { limitInputPixels: 40000000, failOn: 'error' }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height || metadata.pages > 1) throw new Error();
    await sharp(req.file.buffer, { limitInputPixels: 40000000, failOn: 'error' }).toBuffer();
  } catch {
    return sendError(res, 'Invalid image; JPEG, PNG or WebP required', 400);
  }
  const asset = await storeArtwork(req.user.id, `image/${metadata.format}`, req.file.buffer);
  return sendSuccess(res, asset, 'Image uploaded', 201);
});

router.get('/assets/:id', async (req, res) => {
  const asset = await prisma.customizationAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return sendError(res, 'Image not found', 404);
  if (!await canReadArtwork(req.user, asset)) return sendError(res, 'Image not found', 404);
  let bytes;
  try { bytes = await readArtwork(asset.storageKey); } catch (error) { if (error.code === 'ENOENT') return sendError(res, 'Image not found', 404); throw error; }
  res.set({ 'Content-Type': asset.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return res.send(bytes);
});

router.get('/drafts/:productId', async (req, res) => {
  const draft = await prisma.customizationDraft.findUnique({ where: { userId_productId: { userId: req.user.id, productId: req.params.productId } } });
  return sendSuccess(res, draft);
});

router.put('/drafts/:productId', async (req, res) => {
  const draft = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${req.user.id} FOR UPDATE`;
    const design = await validateCustomization(req.user.id, req.body.design, tx);
    if (!await tx.product.findUnique({ where: { id: req.params.productId }, select: { id: true } })) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
    return tx.customizationDraft.upsert({ where: { userId_productId: { userId: req.user.id, productId: req.params.productId } }, create: { userId: req.user.id, productId: req.params.productId, design }, update: { design } });
  });
  return sendSuccess(res, draft);
});

export default router;
