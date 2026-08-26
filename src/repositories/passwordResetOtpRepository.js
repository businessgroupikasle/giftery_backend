import prisma from '../config/db.js';

export const passwordResetOtpRepository = {
  /**
   * Create a new password reset OTP record
   */
  create: ({ userId, otpHash, expiresAt }) =>
    prisma.passwordResetOTP.create({
      data: {
        userId,
        otpHash,
        expiresAt,
      },
    }),

  /**
   * Find the latest active OTP for a given user
   */
  findLatestActiveByUserId: (userId) =>
    prisma.passwordResetOTP.findFirst({
      where: {
        userId,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    }),

  /**
   * Find by ID
   */
  findById: (id) =>
    prisma.passwordResetOTP.findUnique({
      where: { id },
      include: { user: true },
    }),

  /**
   * Increment failed attempt count
   */
  incrementAttempts: (id) =>
    prisma.passwordResetOTP.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
      },
    }),

  /**
   * Mark OTP as verified and store the short-lived reset authorization token
   */
  markAsVerified: (id, resetToken) =>
    prisma.passwordResetOTP.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        resetToken,
      },
    }),

  /**
   * Find record by reset authorization token
   */
  findByResetToken: (resetToken) =>
    prisma.passwordResetOTP.findUnique({
      where: { resetToken },
      include: { user: true },
    }),

  /**
   * Mark OTP & authorization as used
   */
  markAsUsed: (id) =>
    prisma.passwordResetOTP.update({
      where: { id },
      data: {
        usedAt: new Date(),
      },
    }),

  /**
   * Invalidate all active OTPs for a user
   */
  invalidateAllForUser: (userId) =>
    prisma.passwordResetOTP.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    }),
};
