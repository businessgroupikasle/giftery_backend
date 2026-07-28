import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

/**
 * Sends an email using the configured SMTP transporter.
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info(`📧 Email sent to ${to} — messageId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`❌ Email failed to ${to}:`, err);
    throw err;
  }
};

/**
 * Sends an order confirmation email.
 * @param {object} order
 * @param {object} user
 */
export const sendOrderConfirmation = (order, user) => {
  return sendEmail({
    to: user.email,
    subject: `Order Confirmed — #${order.id.slice(-8).toUpperCase()}`,
    html: `
      <h2>Thank you for your order, ${user.name}!</h2>
      <p>Your order <strong>#${order.id.slice(-8).toUpperCase()}</strong> has been placed successfully.</p>
      <p>Total: <strong>$${order.totalAmount.toFixed(2)}</strong></p>
      <p>Status: <strong>${order.status}</strong></p>
      <p>We'll notify you when your order ships.</p>
    `,
  });
};
