import { sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

/**
 * Middleware factory that validates request body/query/params against a Zod schema.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against.
 * @param {'body'|'query'|'params'} [source='body'] - Part of request to validate.
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      const firstMessage = result.error.issues[0]?.message || 'Validation failed';
      return sendError(res, firstMessage, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
    }
    req[source] = result.data;
    next();
  };
};
