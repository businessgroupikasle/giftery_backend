import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

/**
 * Sends a standardised success JSON response.
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} [message='Success']
 * @param {number} [statusCode=200]
 */
export const sendSuccess = (res, data, message = 'Success', statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Sends a standardised error JSON response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=500]
 * @param {any} [errors=null]
 */
export const sendError = (res, message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
