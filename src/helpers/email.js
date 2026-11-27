import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
}).format(Number(value) || 0);

const humanize = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replace(/^./, (character) => character.toUpperCase());

const visibleCustomizationEntries = (customization) => {
  if (!customization || typeof customization !== 'object' || Array.isArray(customization)) return [];
  const hiddenKeys = new Set(['assetIds', 'imageAssetId', 'previewAssetId', 'previewInfo']);
  return Object.entries(customization)
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== null && value !== '' && value !== undefined)
    .map(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return [humanize(key), displayValue];
    });
};

const renderCustomization = (customization) => {
  const entries = visibleCustomizationEntries(customization);
  if (!entries.length) return '';
  return `<div style="margin-top: 8px; padding: 10px 12px; background: #fff7ed; border-left: 3px solid #d99b26; border-radius: 6px;">
    <div style="font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: .06em;">Customization</div>
    ${entries.map(([label, value]) => `<div style="font-size: 12px; color: #475569; margin-top: 4px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join('')}
  </div>`;
};

const formatAddress = (address = {}) => [
  address.fullName || address.name,
  address.addressLine1 || address.street,
  address.landmark,
  [address.city, address.state, address.pincode || address.zip].filter(Boolean).join(', '),
  address.country,
].filter(Boolean);

export const buildOrderConfirmationEmail = (order, user = {}) => {
  const orderNumber = order.orderNumber || order.publicOrderId;
  if (!/^ORD-\d{4}-[A-Z0-9-]+$/i.test(String(orderNumber || ''))) {
    throw new Error('A valid public order number is required for an order confirmation email');
  }

  const customerName = user.name || order.shippingAddress?.fullName || 'Valued Customer';
  const paymentMethod = String(order.paymentMethod || order.payment?.method || 'COD').toUpperCase();
  const rawPaymentStatus = String(order.paymentStatus || order.payment?.status || 'PENDING').toUpperCase();
  const paymentStatus = rawPaymentStatus === 'SUCCEEDED' ? 'PAID' : rawPaymentStatus;
  const pricing = order.pricing || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const addressLines = formatAddress(order.shippingAddress);
  const itemRows = items.map((item) => `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
        <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHtml(item.name || item.product?.name || 'Gift item')}</div>
        ${renderCustomization(item.customization)}
      </td>
      <td style="padding: 14px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; vertical-align: top; color: #475569;">${escapeHtml(item.quantity)}</td>
      <td style="padding: 14px 0; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: top; color: #0f172a; white-space: nowrap;">${escapeHtml(formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0)))}</td>
    </tr>`).join('');

  const summaryRows = [
    ['Subtotal', pricing.subtotal],
    ['Discount', pricing.discountAmount ? -Number(pricing.discountAmount) : null],
    ['Shipping', pricing.shippingFee],
    [`GST (${Number(pricing.taxPercentage) || 0}%)`, pricing.taxAmount],
  ].filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value]) => `<tr><td style="padding: 4px 0; color: #64748b;">${escapeHtml(label)}</td><td style="padding: 4px 0; text-align: right; color: #334155;">${escapeHtml(formatCurrency(value))}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f8fafc; padding: 40px 20px; color: #1e293b;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.05);">
        <div style="background: #111317; padding: 28px 24px; text-align: center; border-bottom: 3px solid #d99b26;">
          <h1 style="color: #f7d58b; font-family: Georgia, serif; font-size: 26px; margin: 0; letter-spacing: .1em;">GIFTERY</h1>
          <p style="color: #bfa163; font-size: 10px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; margin: 4px 0 0;">Premium Gifts, Lasting Impressions</p>
        </div>
        <div style="padding: 32px 28px;">
          <h2 style="font-size: 22px; color: #0f172a; margin: 0 0 12px;">Order confirmed</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">Thank you for your order. We have received it and will begin processing it shortly.</p>
          <div style="margin: 24px 0; padding: 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #9a3412; text-transform: uppercase; letter-spacing: .12em;">Order number</div>
            <div style="font-size: 20px; font-weight: 800; color: #92400e; margin-top: 4px;">${escapeHtml(orderNumber)}</div>
          </div>
          <h3 style="font-size: 16px; color: #0f172a; margin: 28px 0 8px;">Items</h3>
          <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead><tr><th style="padding: 8px 0; border-bottom: 2px solid #cbd5e1; text-align: left; color: #64748b;">Product</th><th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center; color: #64748b;">Qty</th><th style="padding: 8px 0; border-bottom: 2px solid #cbd5e1; text-align: right; color: #64748b;">Amount</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <table role="presentation" style="width: 100%; max-width: 320px; margin: 20px 0 0 auto; border-collapse: collapse; font-size: 13px;">
            ${summaryRows}
            <tr><td style="padding-top: 10px; border-top: 2px solid #cbd5e1; font-weight: 800; color: #0f172a;">Total</td><td style="padding-top: 10px; border-top: 2px solid #cbd5e1; text-align: right; font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(formatCurrency(order.totalAmount))}</td></tr>
          </table>
          <h3 style="font-size: 16px; color: #0f172a; margin: 28px 0 8px;">Delivery address</h3>
          <p style="font-size: 13px; color: #475569; line-height: 1.7; margin: 0;">${addressLines.map(escapeHtml).join('<br>')}</p>
          ${order.shippingAddress?.phone ? `<p style="font-size: 13px; color: #475569; margin-top: 8px;"><strong>Phone:</strong> ${escapeHtml(order.shippingAddress.phone)}</p>` : ''}
          <div style="margin-top: 28px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #64748b;">
            <div>Order status: <strong>${escapeHtml(order.status || 'PENDING')}</strong></div>
            <div>Payment: <strong style="color: ${paymentStatus === 'PAID' ? '#166534' : '#92400e'};">${escapeHtml(paymentMethod)} · ${escapeHtml(paymentStatus)}</strong></div>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} GIFTERY. All rights reserved.</div>
      </div>
    </div>`;

  const text = [
    `Hello ${customerName},`,
    '',
    `Your order ${orderNumber} is confirmed.`,
    '',
    ...items.map((item) => `${item.name || item.product?.name || 'Gift item'} x ${item.quantity} — ${formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}`),
    '',
    `GST (${Number(pricing.taxPercentage) || 0}%): ${formatCurrency(pricing.taxAmount)}`,
    `Total: ${formatCurrency(order.totalAmount)}`,
    '',
    'Delivery address:',
    ...addressLines,
    '',
    `Order status: ${order.status || 'PENDING'}`,
    `Payment: ${paymentMethod} - ${paymentStatus}`,
  ].join('\n');

  return { subject: `Order confirmed — ${orderNumber}`, html, text };
};

export const buildAdminOrderNotificationEmail = (order, user = {}) => {
  const customerName = user.name || order.shippingAddress?.fullName || 'Customer';
  const customerEmail = user.email || order.shippingAddress?.email || 'Not provided';
  const customerEmailContent = buildOrderConfirmationEmail(order, user);
  const html = customerEmailContent.html
    .replace('Order confirmed</h2>', 'New order received</h2>')
    .replace(`Hello <strong>${escapeHtml(customerName)}</strong>,`, `Customer: <strong>${escapeHtml(customerName)}</strong> (${escapeHtml(customerEmail)})`)
    .replace('Thank you for your order. We have received it and will begin processing it shortly.', 'Review the order details below and begin fulfilment.');
  const text = `New order from ${customerName} (${customerEmail})\n\n${customerEmailContent.text}`;
  return { subject: `New order received - ${order.orderNumber}`, html, text };
};
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME || 'GIFTERY'}" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to} — messageId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}:`, err);
    throw err;
  }
};

export const sendOrderConfirmation = (order, user = {}) => {
  const to = user.email || order.shippingAddress?.email;
  if (!to) throw new Error('Customer email is required for an order confirmation email');
  return sendEmail({ to, ...buildOrderConfirmationEmail(order, user) });
};
export const sendAdminOrderNotification = (order, user = {}) => {
  const to = env.ADMIN_NOTIFICATION_EMAIL || env.SMTP_USER;
  if (!to) throw new Error('Admin notification email is not configured');
  return sendEmail({ to, ...buildAdminOrderNotificationEmail(order, user) });
};
// ── Bulk order inquiries ───────────────────────────────────────

export const BULK_OFFER_LABEL = '10% OFF BULK ORDER OFFER';

const formatInquiryDate = (value) => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
}).format(new Date(value || Date.now()));

const bulkInquiryRows = (inquiry) => [
  ['Inquiry ID', inquiry.id],
  ['Product name', inquiry.productName],
  ['Product ID', inquiry.productId],
  ['SKU', inquiry.productSku || 'Not available'],
  ['Requested quantity', Number(inquiry.quantity).toLocaleString('en-IN')],
  ['Customer name', inquiry.name],
  ['Phone number', inquiry.phone],
  ['Email address', inquiry.email],
  ['Company name', inquiry.company || 'Not provided'],
  ['Additional requirements', inquiry.requirements || 'None'],
  ['Submitted at', `${formatInquiryDate(inquiry.createdAt)} IST`],
  ['Offer', BULK_OFFER_LABEL],
];

const renderEmailShell = (title, bodyHtml) => `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 32px 16px; color: #1e293b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="background-color: #111317; padding: 24px; text-align: center; border-bottom: 3px solid #d99b26;">
        <h1 style="color: #f7d58b; font-family: Georgia, serif; font-size: 24px; margin: 0; letter-spacing: 0.1em;">GIFTERY</h1>
      </div>
      <div style="padding: 28px 24px;">
        <h2 style="font-size: 20px; color: #0f172a; margin: 0 0 16px;">${escapeHtml(title)}</h2>
        ${bodyHtml}
      </div>
      <div style="background-color: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} GIFTERY. All rights reserved.
      </div>
    </div>
  </div>`;

const renderRowsTable = (rows) => `
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    ${rows.map(([label, value]) => `<tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 40%; vertical-align: top;">${escapeHtml(label)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600; white-space: pre-wrap;">${escapeHtml(value)}</td>
    </tr>`).join('')}
  </table>`;

export const buildAdminBulkInquiryEmail = (inquiry) => {
  const rows = bulkInquiryRows(inquiry);
  const html = renderEmailShell('New bulk order inquiry', `
    <div style="margin-bottom: 18px; padding: 12px 14px; background: #fff7ed; border-left: 4px solid #d99b26; border-radius: 6px; font-weight: 700; color: #92400e;">
      ${escapeHtml(BULK_OFFER_LABEL)}: confirm bulk pricing, eligibility and availability with the customer.
    </div>
    ${renderRowsTable(rows)}`);
  const text = [
    'New bulk order inquiry',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
  return {
    subject: `Bulk order inquiry: ${inquiry.productName} x ${inquiry.quantity} (${inquiry.id})`,
    html,
    text,
  };
};

export const buildCustomerBulkInquiryEmail = (inquiry) => {
  const rows = [
    ['Inquiry ID', inquiry.id],
    ['Product', inquiry.productName],
    ['SKU', inquiry.productSku || 'Not available'],
    ['Requested quantity', Number(inquiry.quantity).toLocaleString('en-IN')],
    ['Company', inquiry.company || 'Not provided'],
    ['Additional requirements', inquiry.requirements || 'None'],
  ];
  const intro = 'We have received your bulk order inquiry. Our team will contact you shortly to discuss your bulk order and your eligibility for our 10% bulk order offer.';
  const note = 'No discount has been applied yet. Final bulk pricing, eligibility and availability will be confirmed by our team when they contact you.';
  const html = renderEmailShell('Bulk order inquiry received', `
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 0;">Hello <strong>${escapeHtml(inquiry.name)}</strong>,</p>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">${escapeHtml(intro)}</p>
    ${renderRowsTable(rows)}
    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 18px;">${escapeHtml(note)}</p>
    <p style="font-size: 13px; color: #475569; margin-top: 18px;">Regards,<br /><strong>Giftery Team</strong></p>`);
  const text = [
    `Hello ${inquiry.name},`,
    '',
    intro,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    note,
    '',
    'Regards,',
    'Giftery Team',
  ].join('\n');
  return { subject: `We received your bulk order inquiry (${inquiry.id})`, html, text };
};

/**
 * Emails the admin and the customer about a new bulk inquiry.
 * Never throws: each result is reported so a mail failure can't undo a saved inquiry.
 */
export const sendBulkInquiryNotifications = async (inquiry) => {
  const adminTo = env.ADMIN_NOTIFICATION_EMAIL || env.SMTP_USER;
  const [admin, customer] = await Promise.allSettled([
    adminTo
      ? sendEmail({ to: adminTo, ...buildAdminBulkInquiryEmail(inquiry) })
      : Promise.reject(new Error('Admin notification email is not configured')),
    sendEmail({ to: inquiry.email, ...buildCustomerBulkInquiryEmail(inquiry) }),
  ]);
  if (admin.status === 'rejected') {
    logger.warn(`Bulk inquiry ${inquiry.id}: admin notification email not sent — ${admin.reason?.message}`);
  }
  if (customer.status === 'rejected') {
    logger.warn(`Bulk inquiry ${inquiry.id}: customer confirmation email not sent — ${customer.reason?.message}`);
  }
  return { admin: admin.status === 'fulfilled', customer: customer.status === 'fulfilled' };
};

// ── Quote & catalogue enquiries (POST /enquiries) ──────────────

export const CATALOGUE_PDF_PATH = '/downloads/Giftery_Corporate_Catalogue.pdf';
const VALID_EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/**
 * Which enquiries send emails, read from the subject the storefront sets:
 * "Product Quote: <name>" (product page) and "Catalogue Request" /
 * "Corporate Catalogue Request" (floating button, contact page).
 * Other enquiries (contact messages, studio appointments) return null.
 */
export const classifyEnquiry = (enquiry = {}) => {
  const subject = String(enquiry.subject || '');
  if (/appointment/i.test(subject)) return null;
  if (/catalogue/i.test(subject)) return 'CATALOGUE';
  if (/quote/i.test(subject)) return 'QUOTE';
  return null;
};

const ENQUIRY_KINDS = {
  QUOTE: { label: 'Quote request', adminTitle: 'New quote request' },
  CATALOGUE: { label: 'Catalogue download', adminTitle: 'New catalogue download' },
};

const quotedProduct = (enquiry) => String(enquiry.subject || '').replace(/^.*?quote\s*:\s*/i, '').trim();
const catalogueUrl = (siteUrl) => (siteUrl ? `${String(siteUrl).replace(/\/+$/, '')}${CATALOGUE_PDF_PATH}` : null);

export const buildAdminEnquiryEmail = (enquiry, kind) => {
  const { label, adminTitle } = ENQUIRY_KINDS[kind];
  const rows = [
    ['Enquiry ID', enquiry.id],
    ['Type', label],
    ['Customer name', enquiry.name],
    ['Email address', enquiry.email],
    ['Phone number', enquiry.phone || 'Not provided'],
    ['Subject', enquiry.subject],
    ['Details', enquiry.message],
    ['Submitted at', `${formatInquiryDate(enquiry.createdAt)} IST`],
  ];
  const html = renderEmailShell(adminTitle, `
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 0;">
      ${kind === 'QUOTE' ? 'A customer asked for a quotation. Reply with pricing and availability.' : 'A customer downloaded the product catalogue. A follow-up call may turn this into an order.'}
    </p>
    ${renderRowsTable(rows)}`);
  const text = [adminTitle, '', ...rows.map(([key, value]) => `${key}: ${value}`)].join('\n');
  const subject = kind === 'QUOTE'
    ? `New quote request: ${quotedProduct(enquiry) || enquiry.name} (${enquiry.id})`
    : `New catalogue download: ${enquiry.name} (${enquiry.id})`;
  return { subject, html, text };
};

export const buildCustomerEnquiryEmail = (enquiry, kind, siteUrl = env.SITE_URL) => {
  const rows = [
    ['Reference', enquiry.id],
    ...(kind === 'QUOTE' ? [['Product', quotedProduct(enquiry) || 'As described'], ['Your details', enquiry.message]] : []),
  ];
  const link = kind === 'CATALOGUE' ? catalogueUrl(siteUrl) : null;
  const lines = kind === 'QUOTE'
    ? ['Thank you for your quote request. Our gifting team will review your requirements and contact you shortly with pricing and availability.']
    : [
      'Thank you for downloading the Giftery corporate gifting catalogue.',
      'If you would like a quotation, customised branding or bulk pricing, just reply to this email and our team will help you.',
    ];
  const html = renderEmailShell(kind === 'QUOTE' ? 'We received your quote request' : 'Your Giftery catalogue', `
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 0;">Hello <strong>${escapeHtml(enquiry.name)}</strong>,</p>
    ${lines.map((line) => `<p style="font-size: 14px; color: #475569; line-height: 1.6;">${escapeHtml(line)}</p>`).join('')}
    ${link ? `<p style="margin: 22px 0; text-align: center;"><a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 22px; border-radius: 8px; background: #d99b26; color: #111317; font-weight: 700; text-decoration: none;">Download the catalogue (PDF)</a></p>` : ''}
    ${renderRowsTable(rows)}
    <p style="font-size: 13px; color: #475569; margin-top: 18px;">Regards,<br /><strong>Giftery Team</strong></p>`);
  const text = [
    `Hello ${enquiry.name},`, '', ...lines, ...(link ? ['', `Download the catalogue: ${link}`] : []), '',
    ...rows.map(([key, value]) => `${key}: ${value}`), '', 'Regards,', 'Giftery Team',
  ].join('\n');
  return {
    subject: kind === 'QUOTE' ? `We received your quote request (${enquiry.id})` : 'Your Giftery corporate gifting catalogue',
    html,
    text,
  };
};

/**
 * Emails the admin and the customer for quote and catalogue enquiries.
 * Returns null for enquiries that don't send mail. Never throws for a mail failure.
 */
export const sendEnquiryNotifications = async (enquiry) => {
  const kind = classifyEnquiry(enquiry);
  if (!kind) return null;
  const adminTo = env.ADMIN_NOTIFICATION_EMAIL || env.SMTP_USER;
  const [admin, customer] = await Promise.allSettled([
    adminTo
      ? sendEmail({ to: adminTo, ...buildAdminEnquiryEmail(enquiry, kind) })
      : Promise.reject(new Error('Admin notification email is not configured')),
    VALID_EMAIL.test(String(enquiry.email || '').trim())
      ? sendEmail({ to: String(enquiry.email).trim(), ...buildCustomerEnquiryEmail(enquiry, kind) })
      : Promise.reject(new Error('Customer email is missing or invalid')),
  ]);
  if (admin.status === 'rejected') logger.warn(`Enquiry ${enquiry.id}: admin ${kind.toLowerCase()} email not sent — ${admin.reason?.message}`);
  if (customer.status === 'rejected') logger.warn(`Enquiry ${enquiry.id}: customer ${kind.toLowerCase()} email not sent — ${customer.reason?.message}`);
  return { kind, admin: admin.status === 'fulfilled', customer: customer.status === 'fulfilled' };
};
