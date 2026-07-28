import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const TEMP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Removes files older than TEMP_MAX_AGE_MS from the uploads/temp directory.
 */
const cleanupTempFiles = () => {
  const tempDir = path.join(env.UPLOAD_DIR, 'temp');
  if (!fs.existsSync(tempDir)) return;

  const now = Date.now();
  const files = fs.readdirSync(tempDir);
  let removed = 0;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > TEMP_MAX_AGE_MS) {
      fs.unlinkSync(filePath);
      removed++;
    }
  }

  if (removed > 0) {
    logger.info(`🧹 Cleaned up ${removed} temp files`);
  }
};

// Run immediately and then every hour
cleanupTempFiles();
const intervalId = setInterval(cleanupTempFiles, TEMP_MAX_AGE_MS);

// Allow clean shutdown
export const stopCleanupJob = () => clearInterval(intervalId);
