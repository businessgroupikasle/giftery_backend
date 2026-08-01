import { verifyToken } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import prisma from '../config/db.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

/**
 * Verifies JWT from Authorization header and attaches user to req.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No token provided.', HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!user) return sendError(res, 'User not found', HTTP_STATUS.UNAUTHORIZED);
    if (!user.isActive) return sendError(res, 'Account deactivated', HTTP_STATUS.FORBIDDEN);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Restricts route to specific roles.
 * @param {...string} roles - Allowed roles (e.g. 'ADMIN', 'VENDOR').
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }
    const userRole = req.user.role;
    const hasPermission = roles.includes(userRole) || (userRole === 'SUPER_ADMIN' && roles.includes('ADMIN'));
    if (!hasPermission) {
      return sendError(res, 'Access forbidden: insufficient permissions', HTTP_STATUS.FORBIDDEN);
    }
    next();
  };
};
