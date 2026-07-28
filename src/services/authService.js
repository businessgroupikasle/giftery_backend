import bcrypt from 'bcryptjs';
import { authRepository } from '../repositories/authRepository.js';
import { signToken } from '../utils/jwt.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export const authService = {
  register: async ({ name, email, password }) => {
    const existing = await authRepository.findByEmail(email);
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = HTTP_STATUS.CONFLICT;
      throw err;
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await authRepository.create({ name, email, password: hashed });
    const token = signToken({ id: user.id, role: user.role });
    return { user, token };
  },

  login: async ({ email, password }) => {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      throw err;
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      throw err;
    }
    if (!user.isActive) {
      const err = new Error('Account deactivated');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }
    const token = signToken({ id: user.id, role: user.role });
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  },

  getMe: async (id) => authRepository.findById(id),

  changePassword: async (id, { currentPassword, newPassword }) => {
    const user = await authRepository.findByEmail(
      (await authRepository.findById(id)).email
    );
    const fullUser = await authRepository.findByEmail(user.email);
    const isMatch = await bcrypt.compare(currentPassword, fullUser.password);
    if (!isMatch) {
      const err = new Error('Current password is incorrect');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePassword(id, hashed);
  },
};
