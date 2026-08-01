import bcrypt from 'bcryptjs';
import { authRepository } from '../repositories/authRepository.js';
import { signToken } from '../utils/jwt.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emailService } from './emailService.js';

export const authService = {
  requestOTP: async ({ email, name }) => {
    const existing = await authRepository.findByEmail(email);
    if (existing && existing.isEmailVerified) {
      const err = new Error('Email already registered and verified');
      err.statusCode = HTTP_STATUS.CONFLICT;
      throw err;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    const dummyPassword = await bcrypt.hash(Math.random().toString(), 10);

    let user;
    if (existing && !existing.isEmailVerified) {
      user = await authRepository.update(existing.id, {
        name: name || existing.name,
        verificationOTP: otp,
        otpExpiresAt: expiresAt,
      });
    } else {
      user = await authRepository.create({
        name: name || 'Valued User',
        email,
        password: dummyPassword,
        isEmailVerified: false,
        verificationOTP: otp,
        otpExpiresAt: expiresAt,
      });
    }

    await emailService.sendVerificationEmail({ name: user.name, email: user.email, otp });

    return {
      success: true,
      email: user.email,
      otp,
      message: `Verification code sent to ${user.email}`,
    };
  },

  register: async ({ name, email, password, otp }) => {
    const existing = await authRepository.findByEmail(email);
    
    // If OTP is provided, validate OTP and complete registration in 1 step!
    if (otp) {
      if (!existing) {
        const err = new Error('Please click Send OTP to verify your email first.');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }

      if (existing.isEmailVerified) {
        const err = new Error('Email already registered. Please sign in.');
        err.statusCode = HTTP_STATUS.CONFLICT;
        throw err;
      }

      if (existing.verificationOTP !== otp.trim()) {
        const err = new Error('Invalid OTP code. Please check your email.');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }

      if (existing.otpExpiresAt && new Date(existing.otpExpiresAt) < new Date()) {
        const err = new Error('OTP code expired. Please click Send OTP again.');
        err.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw err;
      }

      const hashed = await bcrypt.hash(password, 12);
      const updatedUser = await authRepository.update(existing.id, {
        name,
        password: hashed,
        isEmailVerified: true,
        verificationOTP: null,
        otpExpiresAt: null,
      });

      const token = signToken({ id: updatedUser.id, role: updatedUser.role });
      const { password: _, ...safeUser } = updatedUser;
      return { user: safeUser, token, message: 'Account created and verified successfully!' };
    }

    // Fallback if OTP is not provided upfront
    if (existing && existing.isEmailVerified) {
      const err = new Error('Email already registered');
      err.statusCode = HTTP_STATUS.CONFLICT;
      throw err;
    }

    const hashed = await bcrypt.hash(password, 12);
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let user;
    if (existing && !existing.isEmailVerified) {
      user = await authRepository.update(existing.id, {
        name,
        password: hashed,
        verificationOTP: newOtp,
        otpExpiresAt: expiresAt,
      });
    } else {
      user = await authRepository.create({
        name,
        email,
        password: hashed,
        isEmailVerified: false,
        verificationOTP: newOtp,
        otpExpiresAt: expiresAt,
      });
    }

    await emailService.sendVerificationEmail({ name: user.name, email: user.email, otp: newOtp });

    return {
      requiresVerification: true,
      email: user.email,
      otp: newOtp,
      message: `Verification code sent to ${user.email}`,
    };
  },

  verifyEmail: async ({ email, otp }) => {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      const err = new Error('User account not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    if (user.isEmailVerified) {
      const token = signToken({ id: user.id, role: user.role });
      const { password: _, ...safeUser } = user;
      return { user: safeUser, token, message: 'Email already verified' };
    }

    if (user.verificationOTP !== otp) {
      const err = new Error('Invalid verification code. Please check your email.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (user.otpExpiresAt && new Date(user.otpExpiresAt) < new Date()) {
      const err = new Error('Verification code expired. Please request a new code.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const updated = await authRepository.update(user.id, {
      isEmailVerified: true,
      verificationOTP: null,
      otpExpiresAt: null,
    });

    const token = signToken({ id: updated.id, role: updated.role });
    const { password: _, ...safeUser } = updated;
    return { user: safeUser, token, message: 'Email verified successfully!' };
  },

  resendOTP: async ({ email }) => {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      const err = new Error('User account not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await authRepository.update(user.id, {
      verificationOTP: otp,
      otpExpiresAt: expiresAt,
    });

    await emailService.sendVerificationEmail({ name: user.name, email: user.email, otp });

    return { otp, message: `A new verification code (${otp}) has been dispatched.` };
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

    if (user.role === 'USER' && !user.isEmailVerified) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await authRepository.update(user.id, { verificationOTP: otp, otpExpiresAt: expiresAt });
      await emailService.sendVerificationEmail({ name: user.name, email: user.email, otp });

      const err = new Error(`Email not verified. Your OTP code is ${otp}`);
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      err.requiresVerification = true;
      err.otp = otp;
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
