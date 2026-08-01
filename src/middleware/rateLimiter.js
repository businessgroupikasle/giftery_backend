import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

const handler = (req, res) => {
  sendError(res, 'Too many requests, please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS);
};

const skipInDev = () => env.NODE_ENV === 'development' || process.env.NODE_ENV === 'development';

/**
 * Global rate limiter applied to all routes.
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: skipInDev,
});

/**
 * Stricter limiter for auth endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again in 15 minutes.',
  handler,
  skip: skipInDev,
});
