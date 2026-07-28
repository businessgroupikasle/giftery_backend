import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Deletes a file from the uploads directory safely.
 * @param {string} filePath - Relative path inside uploads dir, or absolute.
 */
export const deleteUploadedFile = (filePath) => {
  try {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(env.UPLOAD_DIR, filePath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
      logger.info(`🗑️  Deleted file: ${absPath}`);
    }
  } catch (err) {
    logger.error(`Failed to delete file ${filePath}:`, err);
  }
};

/**
 * Returns the public URL for an uploaded file.
 * @param {string} filename
 * @param {string} [subDir='']
 * @returns {string}
 */
export const getFileUrl = (filename, subDir = '') => {
  const parts = ['/uploads', subDir, filename].filter(Boolean);
  return parts.join('/');
};
