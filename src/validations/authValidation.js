import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  otp: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const verifyResetOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export const resendResetOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset authorization token is required').optional(),
  token: z.string().min(1).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
}).refine(data => data.resetToken || data.token, {
  message: 'Reset authorization token is required',
  path: ['resetToken'],
});


