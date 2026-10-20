import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../config/logger.js';

// Raster formats that are safe to re-encode; GIF/SVG keep their original file
const OPTIMIZABLE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

export const isOptimizableImage = (mimetype) => OPTIMIZABLE_TYPES.has(String(mimetype || '').toLowerCase());

const toOptimizedWebp = (input) => sharp(input)
  .rotate() // apply EXIF orientation before the metadata is dropped
  .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: WEBP_QUALITY });

/**
 * Re-encodes an image buffer as a resized WebP at `<destDir>/<baseName>.webp`.
 * Returns { filename, size }, or null when the image cannot be processed.
 */
export const saveOptimizedImage = async (buffer, destDir, baseName) => {
  try {
    const filename = `${baseName}.webp`;
    await toOptimizedWebp(buffer).toFile(path.join(destDir, filename));
    return { filename, size: fs.statSync(path.join(destDir, filename)).size };
  } catch (err) {
    logger.warn(`Image optimization skipped: ${err.message}`);
    return null;
  }
};

/**
 * Replaces an uploaded file on disk with an optimized WebP next to it.
 * Returns { filename, size, mimetype }, or null (original kept) when it is not optimizable or fails.
 */
export const optimizeUploadedFile = async (file) => {
  if (!file || !isOptimizableImage(file.mimetype)) return null;
  const dir = path.dirname(file.path);
  const baseName = path.basename(file.filename, path.extname(file.filename));
  const optimized = await saveOptimizedImage(fs.readFileSync(file.path), dir, baseName);
  if (!optimized) return null;
  if (optimized.filename !== file.filename) fs.unlinkSync(file.path);
  return { ...optimized, mimetype: 'image/webp' };
};
