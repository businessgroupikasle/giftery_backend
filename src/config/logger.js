import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from './env.js';

// Ensure logs directory exists
if (!fs.existsSync(env.LOG_DIR)) {
  fs.mkdirSync(env.LOG_DIR, { recursive: true });
}

const { combine, timestamp, colorize, printf, json, errors } = format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`;
  })
);

const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = createLogger({
  level: env.LOG_LEVEL,
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({
      filename: path.join(env.LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
    new transports.File({
      filename: path.join(env.LOG_DIR, 'combined.log'),
      format: fileFormat,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(env.LOG_DIR, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(env.LOG_DIR, 'rejections.log') }),
  ],
});
