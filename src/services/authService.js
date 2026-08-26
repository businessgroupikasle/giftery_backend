import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authRepository } from '../repositories/authRepository.js';
import { passwordResetRepository } from '../repositories/passwordResetRepository.js';
import { passwordResetOtpRepository } from '../repositories/passwordResetOtpRepository.js';
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

  /**
   * Forgot Password — Initiates 6-digit OTP email
   */
  forgotPassword: async ({ email }) => {
    const genericMessage = 'If an account exists with this email, a verification OTP has been sent.';
    if (!email) {
      return { success: true, message: genericMessage };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await authRepository.findByEmail(normalizedEmail);

    // User enumeration protection: return generic message if email does not exist
    if (!user) {
      return { success: true, message: genericMessage };
    }

    // Invalidate previous active OTPs for this user
    await passwordResetOtpRepository.invalidateAllForUser(user.id);

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store token hash in database
    await passwordResetOtpRepository.create({
      userId: user.id,
      otpHash,
      expiresAt,
    });

    // Send 6-digit OTP email via NodeMailer (strictly NO link)
    await emailService.sendPasswordResetOtpEmail({
      name: user.name,
      email: user.email,
      otp,
    });

    return {
      success: true,
      message: genericMessage,
    };
  },

  /**
   * Verify Reset OTP — Validates 6-digit OTP, enforces brute-force limits, returns short-lived resetToken
   */
  verifyResetOTP: async ({ email, otp }) => {
    if (!email || !otp) {
      const err = new Error('Email and 6-digit OTP are required.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await authRepository.findByEmail(normalizedEmail);

    if (!user) {
      const err = new Error('Invalid OTP code. Please request a new OTP.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const activeOTP = await passwordResetOtpRepository.findLatestActiveByUserId(user.id);

    if (!activeOTP) {
      const err = new Error('No active password reset request found. Please request a new OTP.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (activeOTP.verifiedAt) {
      const err = new Error('This OTP has already been verified.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Check brute-force attempts limit (max 5)
    if (activeOTP.attempts >= 5) {
      await passwordResetOtpRepository.markAsUsed(activeOTP.id);
      const err = new Error('Too many failed attempts. This OTP is now invalid. Please request a new OTP.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Check expiry (5 minutes)
    if (new Date() > new Date(activeOTP.expiresAt)) {
      await passwordResetOtpRepository.markAsUsed(activeOTP.id);
      const err = new Error('OTP has expired. Please request a new OTP.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Compare SHA-256 hash
    const submittedHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (submittedHash !== activeOTP.otpHash) {
      await passwordResetOtpRepository.incrementAttempts(activeOTP.id);
      const remainingAttempts = 4 - activeOTP.attempts;
      const err = new Error(
        remainingAttempts > 0
          ? `Invalid OTP code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid OTP code. Maximum attempts reached. Please request a new OTP.'
      );
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Generate cryptographically secure short-lived reset authorization token
    const resetToken = crypto.randomBytes(32).toString('hex');
    await passwordResetOtpRepository.markAsVerified(activeOTP.id, resetToken);

    return {
      success: true,
      resetToken,
      message: 'OTP verified successfully. Please set your new password.',
    };
  },

  /**
   * Resend Reset OTP — Invalidates old OTP and generates fresh 6-digit OTP
   */
  resendResetOTP: async ({ email }) => {
    const genericMessage = 'If an account exists with this email, a verification OTP has been sent.';
    if (!email) {
      return { success: true, message: genericMessage };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await authRepository.findByEmail(normalizedEmail);

    if (!user) {
      return { success: true, message: genericMessage };
    }

    // Invalidate previous active OTPs
    await passwordResetOtpRepository.invalidateAllForUser(user.id);

    // Generate new 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await passwordResetOtpRepository.create({
      userId: user.id,
      otpHash,
      expiresAt,
    });

    await emailService.sendPasswordResetOtpEmail({
      name: user.name,
      email: user.email,
      otp,
    });

    return {
      success: true,
      message: genericMessage,
    };
  },

  /**
   * Reset Password — Validates resetToken, hashes password, updates user, invalidates session
   */
  resetPassword: async ({ resetToken, token, password }) => {
    const authToken = resetToken || token;
    if (!authToken) {
      const err = new Error('Reset authorization token is required.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    const otpRecord = await passwordResetOtpRepository.findByResetToken(authToken.trim());

    if (!otpRecord) {
      const err = new Error('Invalid or expired reset session. Please restart the password reset process.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (!otpRecord.verifiedAt) {
      const err = new Error('OTP verification is required before resetting password.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    if (otpRecord.usedAt) {
      const err = new Error('This password reset authorization has already been used.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Authorization token valid for 15 minutes after verification
    const authExpiry = new Date(new Date(otpRecord.verifiedAt).getTime() + 15 * 60 * 1000);
    if (new Date() > authExpiry) {
      await passwordResetOtpRepository.markAsUsed(otpRecord.id);
      const err = new Error('Password reset session has expired. Please request a new OTP.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Password complexity check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      const err = new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Hash new password using existing bcrypt implementation
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password in database
    await authRepository.updatePassword(otpRecord.userId, hashedPassword);

    // Invalidate the OTP authorization record
    await passwordResetOtpRepository.markAsUsed(otpRecord.id);

    return {
      success: true,
      message: 'Password reset successfully. Please login with your new password.',
    };
  },
};
