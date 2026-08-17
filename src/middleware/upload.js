import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

const getUploadDir = () => {
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
};

// Ensure upload directory exists
const targetDir = getUploadDir();
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseDir = getUploadDir();
    const subDir = req.uploadDir ? path.join(baseDir, req.uploadDir) : baseDir;
    fs.mkdirSync(subDir, { recursive: true });
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = env.ALLOWED_FILE_TYPES.split(',');
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { statusCode: HTTP_STATUS.BAD_REQUEST }),
      false
    );
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter,
});

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for bulk import files / ZIPs with images
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ['.xlsx', '.xls', '.csv', '.zip'].includes(ext) ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.mimetype.includes('csv') ||
      file.mimetype.includes('zip') ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error('Please upload a valid Excel (.xlsx, .xls) or ZIP file (.zip)'), { statusCode: 400 }),
        false
      );
    }
  },
});
