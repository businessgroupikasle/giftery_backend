import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs a JWT access token.
 * @param {object} payload - Data to encode in the token.
 * @returns {string} Signed JWT string.
 */
export const signToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
};

/**
 * Verifies a JWT access token.
 * @param {string} token - JWT string to verify.
 * @returns {object} Decoded payload.
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Signs a JWT refresh token.
 * @param {object} payload
 * @returns {string}
 */
export const signRefreshToken = (payload) => {
  if (!env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET not configured');
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
};

/**
 * Verifies a JWT refresh token.
 * @param {string} token
 * @returns {object}
 */
export const verifyRefreshToken = (token) => {
  if (!env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET not configured');
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};
