import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emitCustomerCreated } from '../sockets/index.js';

export const authController = {
  requestOTP: async (req, res, next) => {
    try {
      const result = await authService.requestOTP(req.body);
      sendSuccess(res, result, result.message, HTTP_STATUS.OK);
    } catch (err) { next(err); }
  },

  register: async (req, res, next) => {
    try {
      const result = await authService.register(req.body);

      // Emit Socket.IO event only after database user creation succeeds
      if (result.user) {
        emitCustomerCreated({
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role || 'USER',
          createdAt: result.user.createdAt || new Date().toISOString(),
        });
      }

      sendSuccess(res, result, result.message || 'Account created successfully', HTTP_STATUS.CREATED);
    } catch (err) { next(err); }
  },

  verifyEmail: async (req, res, next) => {
    try {
      const { user, token, message } = await authService.verifyEmail(req.body);
      sendSuccess(res, { user, token }, message, HTTP_STATUS.OK);
    } catch (err) { next(err); }
  },

  resendOTP: async (req, res, next) => {
    try {
      const result = await authService.resendOTP(req.body);
      sendSuccess(res, result, result.message, HTTP_STATUS.OK);
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

  forgotPassword: async (req, res, next) => {
    try {
      const result = await authService.forgotPassword(req.body);
      sendSuccess(res, null, result.message, HTTP_STATUS.OK);
    } catch (err) { next(err); }
  },

  verifyResetOTP: async (req, res, next) => {
    try {
      const result = await authService.verifyResetOTP(req.body);
      sendSuccess(res, { resetToken: result.resetToken }, result.message, HTTP_STATUS.OK);
    } catch (err) { next(err); }
  },

  resendResetOTP: async (req, res, next) => {
    try {
      const result = await authService.resendResetOTP(req.body);
      sendSuccess(res, null, result.message, HTTP_STATUS.OK);
    } catch (err) { next(err); }
  },

  resetPassword: async (req, res, next) => {
    try {
      const result = await authService.resetPassword(req.body);
      sendSuccess(res, null, result.message, HTTP_STATUS.OK);
    } catch (err) { next(err); }
  },

  logout: (_req, res) => {
    sendSuccess(res, null, 'Logged out successfully');
  },
};

