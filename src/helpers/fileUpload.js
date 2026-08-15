import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const getUploadDir = () => {
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
};

export const fileUploadHelper = {
  getUploadUrl: (filename) => {
    if (!filename) return null;
    const baseUrl = env.API_BASE_URL || 'http://localhost:5000';
    const uploadPath = filename.startsWith('/') ? filename : `/${filename}`;
    return `${baseUrl}/uploads${uploadPath}`;
  },

  getUploadPath: (filename) => {
    const baseDir = getUploadDir();
    return path.join(baseDir, filename);
  },

  validateImageUrl: (url) => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
    if (trimmed.startsWith('data:image/')) return true;
    if (trimmed.startsWith('/images/') || trimmed.startsWith('/placeholder')) return true;

    const uploadDir = getUploadDir();
    const subPath = trimmed.includes('/uploads/') ? trimmed.split('/uploads/')[1] : trimmed;
    const fullPath = path.join(uploadDir, subPath || '');
    const normalizedPath = path.normalize(fullPath);
    const normalizedUploadDir = path.normalize(uploadDir);
    return normalizedPath.startsWith(normalizedUploadDir);
  },

  validateImageUrls: (urls = []) => {
    if (!Array.isArray(urls)) return false;
    return urls.length > 0 && urls.every(url => fileUploadHelper.validateImageUrl(url));
  },

  deleteFile: (filename) => {
    try {
      const filePath = fileUploadHelper.getUploadPath(filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true, filename };
      }
      return { success: false, filename, reason: 'File not found' };
    } catch (error) {
      return { success: false, filename, reason: error.message };
    }
  },

  deleteMultipleFiles: (filenames = []) => {
    const results = {
      deleted: [],
      failed: [],
    };

    filenames.forEach(filename => {
      const result = fileUploadHelper.deleteFile(filename);
      if (result.success) {
        results.deleted.push(filename);
      } else {
        results.failed.push({ filename, reason: result.reason });
      }
    });

    return results;
  },

  deleteImagesByUrls: (imageUrls = []) => {
    const filenames = imageUrls
      .map(url => {
        if (!url) return null;
        const parts = url.split('/uploads/');
        return parts.length > 1 ? parts[1] : null;
      })
      .filter(Boolean);

    return fileUploadHelper.deleteMultipleFiles(filenames);
  },

  getFileMetadata: (filename) => {
    try {
      const filePath = fileUploadHelper.getUploadPath(filename);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const stats = fs.statSync(filePath);
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        exists: true,
      };
    } catch (error) {
      return null;
    }
  },

  fileExists: (filename) => {
    try {
      const filePath = fileUploadHelper.getUploadPath(filename);
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  },

  ensureUploadDirExists: () => {
    try {
      const uploadDir = getUploadDir();
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  },
};
