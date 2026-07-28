import { logger } from '../config/logger.js';
import { sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

/**
 * Global Express error handler middleware.
 * Must be registered after all routes.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack, url: req.url, method: req.method });

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return sendError(res, `${field} already exists`, HTTP_STATUS.CONFLICT);
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return sendError(res, 'Record not found', HTTP_STATUS.NOT_FOUND);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', HTTP_STATUS.UNAUTHORIZED);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired, please login again', HTTP_STATUS.UNAUTHORIZED);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'File too large', HTTP_STATUS.BAD_REQUEST);
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return sendError(res, 'Validation failed', HTTP_STATUS.UNPROCESSABLE_ENTITY, err.errors);
  }

  // Generic error
  const statusCode = err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};
