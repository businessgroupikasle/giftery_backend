import { Router } from 'express';
import multer from 'multer';
import prisma from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { canReadArtwork, customizationService } from '../services/customizationService.js';
import { storeArtwork, readArtwork, deleteArtwork } from '../services/artworkStorage.js';
import { inspectArtwork } from '../services/artworkValidation.js';
import { ASSET_KINDS, REVIEW_STATUSES } from '../validations/customizationValidation.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
router.use(authenticate);

const cleanFileName = (name) => {
  if (typeof name !== 'string') return null;
  const cleaned = name.replace(/[^\w.\- ()]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return cleaned || null;
};

// ── Private assets ──────────────────────────────────────────────
router.post('/assets', upload.single('image'), async (req, res) => {
  if (!req.file) return sendError(res, 'Image is required', 400);
  const kind = req.body?.kind || 'LOGO';
  if (!ASSET_KINDS.includes(kind)) return sendError(res, 'Invalid image type', 400);
  const { mimeType, data, width, height, source } = await inspectArtwork(req.file.buffer);
  const asset = await storeArtwork(req.user.id, mimeType, data, { kind, originalName: cleanFileName(req.file.originalname), width, height, source });
  return sendSuccess(res, asset, 'Image uploaded', 201);
});

router.get('/assets', async (req, res) => {
  const kind = ASSET_KINDS.includes(req.query.kind) ? req.query.kind : undefined;
  return sendSuccess(res, await customizationService.listAssets(req.user.id, kind));
});

router.get('/assets/:id', async (req, res) => {
  const asset = await prisma.customizationAsset.findUnique({ where: { id: req.params.id } });
  if (!asset || !await canReadArtwork(req.user, asset)) return sendError(res, 'Image not found', 404);
  const wantsSource = req.query.source === '1';
  if (wantsSource && !asset.sourceStorageKey) return sendError(res, 'Image not found', 404);
  let bytes;
  try {
    bytes = await readArtwork(wantsSource ? asset.sourceStorageKey : asset.storageKey);
  } catch (error) {
    if (error.code === 'ENOENT') return sendError(res, 'Image not found', 404);
    throw error;
  }
  res.set({ 'Content-Type': wantsSource ? 'image/svg+xml' : asset.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  if (wantsSource) {
    // Uploaded SVG is only ever handed over as an inert download.
    res.set({ 'Content-Disposition': `attachment; filename="${cleanFileName(asset.originalName) || 'artwork.svg'}"`, 'Content-Security-Policy': "default-src 'none'; sandbox" });
  }
  return res.send(bytes);
});

router.delete('/assets/:id', async (req, res) => {
  await customizationService.removeAsset(req.user.id, req.params.id);
  return sendSuccess(res, null, 'Image deleted');
});

// ── Saved designs (always scoped to the signed-in customer) ─────
router.get('/designs', async (req, res) => sendSuccess(res, await customizationService.listDesigns(req.user.id, {
  productId: typeof req.query.productId === 'string' ? req.query.productId : undefined,
  page: req.query.page,
  limit: req.query.limit,
})));

router.post('/designs', async (req, res) => sendSuccess(res, await customizationService.createDesign(req.user.id, req.body), 'Design created', 201));
router.get('/designs/:id', async (req, res) => sendSuccess(res, await customizationService.getDesign(req.user.id, req.params.id)));
router.put('/designs/:id', async (req, res) => sendSuccess(res, await customizationService.updateDesign(req.user.id, req.params.id, req.body), 'Design saved'));
router.post('/designs/:id/duplicate', async (req, res) => sendSuccess(res, await customizationService.duplicateDesign(req.user.id, req.params.id), 'Design duplicated', 201));

router.delete('/designs/:id', async (req, res) => {
  await customizationService.deleteDesign(req.user.id, req.params.id);
  return sendSuccess(res, null, 'Design deleted');
});

router.post('/designs/:id/finalize', upload.single('preview'), async (req, res) => {
  if (!req.file) return sendError(res, 'A design preview is required', 400);
  const expectedRevision = Number(req.body?.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return sendError(res, 'Invalid design revision', 400);
  await customizationService.getDesign(req.user.id, req.params.id);
  const { mimeType, data, width, height, source } = await inspectArtwork(req.file.buffer);
  if (source) return sendError(res, 'The preview must be a PNG or JPG image', 400);
  const stored = await storeArtwork(req.user.id, mimeType, data, { kind: 'PREVIEW', originalName: 'design-preview', width, height });
  const previewInfo = {
    width,
    height,
    includesProductImage: req.body?.includesProductImage === 'true',
    generatedAt: new Date().toISOString(),
    mockupOnly: true,
  };
  try {
    return sendSuccess(res, await customizationService.finalizeDesign(req.user.id, req.params.id, expectedRevision, stored.id, previewInfo), 'Design saved');
  } catch (error) {
    await prisma.customizationAsset.delete({ where: { id: stored.id } }).then((row) => deleteArtwork(row.storageKey)).catch(() => {});
    throw error;
  }
});

// ── Staff: designs that are part of a placed order ──────────────
router.get('/admin/items', authorize('ADMIN'), async (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : undefined;
  if (status && !REVIEW_STATUSES.includes(status)) return sendError(res, 'Invalid status', 400);
  return sendSuccess(res, await customizationService.listOrderedItems({
    status,
    search: typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : undefined,
    page: req.query.page,
    limit: req.query.limit,
  }));
});

router.patch('/admin/items/:id/status', authorize('ADMIN'), async (req, res) => sendSuccess(res, await customizationService.updateReviewStatus(req.params.id, req.body), 'Customization status updated'));

export default router;
