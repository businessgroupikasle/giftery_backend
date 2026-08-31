import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ── Security ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) || origin === env.CORS_ORIGIN) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Logging ─────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Rate Limiting ───────────────────────────────────────────────
app.use(globalLimiter);

// ── Body Parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Static Files (Uploads) ─────────────────────────────────────
const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Automatically sync seed-assets into uploadPath if seed-assets directory exists
const seedAssetsDir = path.resolve(__dirname, '../seed-assets');
if (fs.existsSync(seedAssetsDir)) {
  try {
    const seedFiles = fs.readdirSync(seedAssetsDir);
    for (const file of seedFiles) {
      const srcFile = path.join(seedAssetsDir, file);
      const destFile = path.join(uploadPath, file);
      if (fs.statSync(srcFile).isFile() && !fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  } catch (err) {
    logger.warn(`Failed to copy seed assets to uploads directory: ${err.message}`);
  }
}
app.use('/uploads', express.static(uploadPath));

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes);

// ── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ────────────────────────────────────────
app.use(errorHandler);

export default app;
