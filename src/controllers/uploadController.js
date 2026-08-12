import fs from 'fs';
import path from 'path';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { env } from '../config/env.js';
import { fileUploadHelper } from '../helpers/fileUpload.js';

const getUploadDir = () => {
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
};

export const uploadController = {
  uploadSingle: (req, res, next) => {
    try {
      const uploadDir = getUploadDir();
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      if (req.file) {
        const relPath = req.file.filename;
        const fileUrl = `/uploads/${relPath}`;

        if (!fs.existsSync(path.join(uploadDir, relPath))) {
          return sendError(res, 'File upload verification failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }

        return sendSuccess(res, {
          url: fileUrl,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        }, 'Image uploaded successfully', HTTP_STATUS.CREATED);
      }

      if (req.body && req.body.image && typeof req.body.image === 'string' && req.body.image.startsWith('data:image')) {
        try {
          const matches = req.body.image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (!matches) {
            return sendError(res, 'Invalid base64 image format', HTTP_STATUS.BAD_REQUEST);
          }

          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
          const filePath = path.join(uploadDir, filename);

          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

          if (!fs.existsSync(filePath)) {
            return sendError(res, 'Base64 image save failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          const fileUrl = `/uploads/${filename}`;
          return sendSuccess(res, { url: fileUrl, filename, size: Buffer.from(base64Data, 'base64').length }, 'Image uploaded successfully', HTTP_STATUS.CREATED);
        } catch (err) {
          return sendError(res, `Base64 upload error: ${err.message}`, HTTP_STATUS.BAD_REQUEST);
        }
      }

      return sendError(res, 'No file provided', HTTP_STATUS.BAD_REQUEST);
    } catch (err) {
      next(err);
    }
  },

  uploadMultiple: (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return sendError(res, 'No files provided', HTTP_STATUS.BAD_REQUEST);
      }

      const uploadDir = getUploadDir();
      const results = [];
      const failed = [];

      req.files.forEach(file => {
        const relPath = file.filename;
        const filePath = path.join(uploadDir, relPath);

        if (!fs.existsSync(filePath)) {
          failed.push({ filename: file.filename, reason: 'File verification failed' });
          return;
        }

        results.push({
          url: `/uploads/${relPath}`,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
        });
      });

      if (results.length === 0) {
        return sendError(res, 'All files failed to upload', HTTP_STATUS.BAD_REQUEST);
      }

      return sendSuccess(res, {
        files: results,
        failed,
        total: req.files.length,
        succeeded: results.length
      }, 'Batch upload completed', HTTP_STATUS.CREATED);
    } catch (err) {
      next(err);
    }
  },

  deleteFile: (req, res, next) => {
    try {
      const { filename } = req.params;

      if (!filename || filename.includes('..') || filename.includes('/')) {
        return sendError(res, 'Invalid filename', HTTP_STATUS.BAD_REQUEST);
      }

      const result = fileUploadHelper.deleteFile(filename);

      if (!result.success) {
        return sendError(res, `Failed to delete file: ${result.reason}`, HTTP_STATUS.NOT_FOUND);
      }

      return sendSuccess(res, { filename }, 'File deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  deleteMultiple: (req, res, next) => {
    try {
      const { filenames } = req.body;

      if (!Array.isArray(filenames) || filenames.length === 0) {
        return sendError(res, 'No filenames provided', HTTP_STATUS.BAD_REQUEST);
      }

      const validFilenames = filenames.filter(f => f && !f.includes('..') && !f.includes('/'));

      if (validFilenames.length === 0) {
        return sendError(res, 'All filenames are invalid', HTTP_STATUS.BAD_REQUEST);
      }

      const result = fileUploadHelper.deleteMultipleFiles(validFilenames);

      return sendSuccess(res, result, 'Batch deletion completed');
    } catch (err) {
      next(err);
    }
  },

  validateUrl: (req, res, next) => {
    try {
      const { url } = req.params;

      if (!url) {
        return sendError(res, 'URL parameter required', HTTP_STATUS.BAD_REQUEST);
      }

      const decodedUrl = decodeURIComponent(url);
      const isValid = fileUploadHelper.validateImageUrl(decodedUrl);

      return sendSuccess(res, { url: decodedUrl, valid: isValid });
    } catch (err) {
      next(err);
    }
  },
};
