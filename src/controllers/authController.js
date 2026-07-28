import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export const authController = {
  register: async (req, res, next) => {
    try {
      const { user, token } = await authService.register(req.body);
      sendSuccess(res, { user, token }, 'Account created successfully', HTTP_STATUS.CREATED);
    } catch (err) { next(err); }
  },

  login: async (req, res, next) => {
    try {
      const { user, token } = await authService.login(req.body);
      sendSuccess(res, { user, token }, 'Login successful');
    } catch (err) { next(err); }
  },

  getMe: async (req, res, next) => {
    try {
      const user = await authService.getMe(req.user.id);
      sendSuccess(res, { user });
    } catch (err) { next(err); }
  },

  changePassword: async (req, res, next) => {
    try {
      await authService.changePassword(req.user.id, req.body);
      sendSuccess(res, null, 'Password updated successfully');
    } catch (err) { next(err); }
  },

  logout: (_req, res) => {
    sendSuccess(res, null, 'Logged out successfully');
  },
};
