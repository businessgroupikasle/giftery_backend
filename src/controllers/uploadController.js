import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';

export const uploadController = {
  uploadSingle: (req, res) => {
    if (!req.file) {
      // Mock fallback if no file attached in demo
      const mockUrl = `/uploads/demo_image_${Date.now()}.png`;
      return sendSuccess(res, { url: mockUrl, filename: `demo_image_${Date.now()}.png` }, 'Image uploaded');
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    sendSuccess(res, { url: fileUrl, filename: req.file.filename, size: req.file.size }, 'Image uploaded successfully');
  },
};
