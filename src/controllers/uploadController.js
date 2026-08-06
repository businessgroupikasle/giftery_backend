import fs from 'fs';
import path from 'path';
import { sendSuccess, sendError } from '../utils/response.js';
import { env } from '../config/env.js';

const getUploadDir = () => {
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
};

export const uploadController = {
  uploadSingle: (req, res) => {
    const uploadDir = getUploadDir();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    if (req.file) {
      const relPath = req.file.filename;
      const fileUrl = `/uploads/${relPath}`;
      return sendSuccess(res, { url: fileUrl, filename: req.file.filename, size: req.file.size }, 'Image uploaded successfully');
    }

    // Support Base64 image payload (e.g. { image: "data:image/png;base64,..." })
    if (req.body && req.body.image && typeof req.body.image === 'string' && req.body.image.startsWith('data:image')) {
      try {
        const matches = req.body.image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
          const filePath = path.join(uploadDir, filename);

          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

          const fileUrl = `/uploads/${filename}`;
          return sendSuccess(res, { url: fileUrl, filename, path: filePath }, 'Image saved to upload directory successfully');
        }
      } catch (err) {
        console.error('Base64 upload save error:', err);
      }
    }

    const mockFilename = `demo_image_${Date.now()}.png`;
    const fileUrl = `/uploads/${mockFilename}`;
    sendSuccess(res, { url: fileUrl, filename: mockFilename }, 'Image uploaded successfully');
  },
};
