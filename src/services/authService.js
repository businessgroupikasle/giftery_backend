import bcrypt from 'bcryptjs';
import { authRepository } from '../repositories/authRepository.js';
import { signToken } from '../utils/jwt.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emailService } from './emailService.js';

// In-memory temporary OTP Store (Email -> { otp, name, expiresAt, verified })
const pendingOTPStore = new Map();

export const authService = {
  /**
   * Request OTP — Sends code via email without touching DB
   */
  requestOTP: async ({ email, name }) => {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await authRepository.findByEmail(normalizedEmail);
    if (existing && existing.isEmailVerified) {
      const err = new Error('Email is already registered and verified. Please sign in.');
      err.statusCode = HTTP_STATUS.CONFLICT;
      throw err;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    pendingOTPStore.set(normalizedEmail, {
      otp,
      name: name || 'Valued User',
      expiresAt,
      verified: false,
    });

    await emailService.sendVerificationEmail({ name: name || 'Valued User', email: normalizedEmail, otp });

    return {
      success: true,
      email: normalizedEmail,
      message: `Verification code sent to ${normalizedEmail}`,
    };
  },

  /**
   * Verify Email / OTP Code inline
   */
  verifyEmail: async ({ email, otp }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const record = pendingOTPStore.get(normalizedEmail);

    if (!record) {
      const err = new Error('No active OTP request found for this email. Please click Send OTP.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (Date.now() > record.expiresAt) {
      const err = new Error('Verification OTP code has expired. Please click Send OTP again.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (record.otp !== otp?.trim()) {
      const err = new Error('Invalid OTP code. Please check your email and try again.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    record.verified = true;
    pendingOTPStore.set(normalizedEmail, record);

    return { success: true, message: 'OTP code verified successfully!' };
  },

  /**
   * Register User — ONLY creates user in DB after OTP is verified & submit form is clicked
   */
  register: async ({ name, email, password, otp }) => {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await authRepository.findByEmail(normalizedEmail);
    if (existing && existing.isEmailVerified) {
      const err = new Error('Email is already registered. Please sign in.');
      err.statusCode = HTTP_STATUS.CONFLICT;
      throw err;
    }

    const record = pendingOTPStore.get(normalizedEmail);
    if (!record || (!record.verified && record.otp !== otp?.trim())) {
      const err = new Error('Please verify your OTP code before creating your account.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (Date.now() > record.expiresAt) {
      const err = new Error('Verification OTP code expired. Please click Send OTP again.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Validate strong password
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      const err = new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Hash Password & Create User Record in Database NOW
    const hashedPassword = await bcrypt.hash(password, 12);

    let user;
    if (existing) {
      user = await authRepository.update(existing.id, {
        name: name || record.name,
        password: hashedPassword,
        isEmailVerified: true,
        verificationOTP: null,
        otpExpiresAt: null,
      });
    } else {
      user = await authRepository.create({
        name: name || record.name,
        email: normalizedEmail,
        password: hashedPassword,
        isEmailVerified: true,
        verificationOTP: null,
        otpExpiresAt: null,
      });
    }

    // Clean up temporary OTP store
    pendingOTPStore.delete(normalizedEmail);

    const token = signToken({ id: user.id, role: user.role });
    const { password: _, ...safeUser } = user;

    return {
      user: safeUser,
      token,
      message: 'Account created and verified successfully!',
    };
  },

  /**
   * Resend OTP Code
   */
  resendOTP: async ({ email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const existingRecord = pendingOTPStore.get(normalizedEmail);
    const userName = existingRecord?.name || 'Valued User';

    pendingOTPStore.set(normalizedEmail, {
      otp,
      name: userName,
      expiresAt,
      verified: false,
    });

    await emailService.sendVerificationEmail({ name: userName, email: normalizedEmail, otp });

    return { message: `A new verification code has been sent to ${normalizedEmail}.` };
  },

  /**
   * Login User
   */
  login: async ({ email, password }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await authRepository.findByEmail(normalizedEmail);
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
    const user = await authRepository.findById(id);
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
