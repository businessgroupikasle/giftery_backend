import prisma from '../config/db.js';

export const passwordResetRepository = {
  /**
   * Create a new password reset token record
   */
  create: ({ userId, tokenHash, expiresAt }) =>
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),

  /**
   * Find a token record by token hash
   */
  findByTokenHash: (tokenHash) =>
    prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    }),

  /**
   * Mark token as used
   */
  markAsUsed: (id) =>
    prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    }),

  /**
   * Invalidate all unused tokens for a user
   */
  invalidateAllForUser: (userId) =>
    prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    }),
};
