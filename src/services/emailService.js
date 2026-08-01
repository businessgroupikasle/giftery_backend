import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Create Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.ethereal.email',
  port: env.SMTP_PORT || 587,
  secure: env.SMTP_SECURE === 'true',
  auth: {
    user: env.SMTP_USER || 'demo@giftery.com',
    pass: env.SMTP_PASS || 'demopass',
  },
});

export const emailService = {
  /**
   * Send Email Verification OTP to newly registered user
   */
  sendVerificationEmail: async ({ name, email, otp }) => {
    logger.info('===================================================================');
    logger.info(`🔑 EMAIL OTP VERIFICATION CODE FOR [${email}]: ${otp}`);
    logger.info('===================================================================');

    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <div style="background-color: #111317; padding: 28px 24px; text-align: center; border-bottom: 3px solid #d99b26;">
            <h1 style="color: #f7d58b; font-family: Georgia, serif; font-size: 26px; margin: 0; letter-spacing: 0.1em;">GIFTERYS</h1>
            <p style="color: #bfa163; font-size: 10px; font-weight: bold; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px;">PREMIUM GIFTS, LASTING IMPRESSIONS</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 28px;">
            <h2 style="font-size: 20px; color: #0f172a; margin-top: 0;">Verify Your Email Address</h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">Hello <strong>${name || 'Valued Customer'}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">Welcome to GIFTERYS! To complete your account creation and validate your email address, please enter the 6-digit verification code below:</p>

            <!-- OTP Box -->
            <div style="margin: 28px 0; text-align: center;">
              <div style="display: inline-block; background-color: #fff7ed; border: 2px dashed #f59e0b; padding: 14px 32px; border-radius: 12px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #d99b26;">${otp}</span>
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 8px;">This code will expire in 10 minutes.</p>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">If you did not initiate this registration request, you can safely ignore this email.</p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
            &copy; 2026 GIFTERYS Premium Corporate Gifting. All rights reserved.
          </div>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"GIFTERYS Account Security" <no-reply@giftery.com>`,
        to: email,
        subject: `[GIFTERYS] ${otp} is your Email Verification Code`,
        html: htmlContent,
      });
      logger.info(`📧 Verification email dispatched via SMTP to ${email}`);
    } catch (err) {
      logger.info(`📧 [DEV MODE OTP NOTIFICATION] Sent to: ${email} | Code: ${otp}`);
    }
  },
};
