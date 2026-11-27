import prisma from '../config/db.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { normalizeContactPhone } from '../utils/phone.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { nextEnquiryId } from '../utils/enquiryId.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emitEnquiryCreated } from '../sockets/index.js';
import { BULK_OFFER_LABEL, sendBulkInquiryNotifications } from '../helpers/email.js';

export const BULK_ORDER_ENQUIRY_TYPE = 'BULK_ORDER';

/** Sales pipeline for a bulk inquiry, in the order the admin dashboard shows them. */
export const BULK_ORDER_STATUSES = ['New', 'Contacted', 'Quoted', 'Converted', 'Closed'];

/* A second inquiry for the same product from the same email inside this window is treated as a repeat. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Readable summary kept in the generic subject/message columns, so the inquiry
 * reads correctly in the admin "Customer Enquiries" list without dashboard changes.
 */
export const buildBulkInquirySummary = ({ productName, productId, productSku, quantity, company, requirements }) => ({
  subject: `Bulk Order Inquiry: ${productName}`,
  message: [
    BULK_OFFER_LABEL,
    `Product: ${productName}`,
    `Product ID: ${productId}`,
    `SKU: ${productSku || 'Not available'}`,
    `Requested quantity: ${quantity}`,
    `Company: ${company || 'Not provided'}`,
    `Additional requirements: ${requirements || 'None'}`,
  ].join('\n'),
});

const isUniqueIdConflict = (err) => err?.code === 'P2002';

/**
 * Saves a bulk order inquiry for an active product and notifies the admin.
 * Prices, carts and orders are never touched: this only records the request.
 * @param {object} input validated body from bulkOrderInquirySchema
 */
export const createBulkOrderInquiry = async (input) => {
  let phone;
  try {
    phone = normalizeContactPhone(input.phone);
  } catch (err) {
    throw new AppError(err.message, HTTP_STATUS.BAD_REQUEST);
  }
  if (!phone) throw new AppError('Phone number is required', HTTP_STATUS.BAD_REQUEST);

  const product = await prisma.product.findFirst({
    where: { id: input.productId, isActive: true },
    select: { id: true, name: true, sku: true },
  });
  if (!product) {
    throw new AppError('This product is not available for bulk inquiries.', HTTP_STATUS.NOT_FOUND);
  }

  const recent = await prisma.enquiry.findFirst({
    where: {
      type: BULK_ORDER_ENQUIRY_TYPE,
      productId: product.id,
      email: input.email,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    throw new AppError(
      `You have already submitted a bulk inquiry for this product (${recent.id}). Our team will contact you shortly.`,
      HTTP_STATUS.CONFLICT
    );
  }

  const details = {
    productId: product.id,
    productName: product.name,
    productSku: product.sku || null,
    quantity: input.quantity,
    company: input.company,
    requirements: input.requirements,
  };

  let inquiry;
  // Two inquiries can race for the same readable ID; retry with the next one.
  for (let attempt = 0; !inquiry; attempt += 1) {
    try {
      inquiry = await prisma.enquiry.create({
        data: {
          id: await nextEnquiryId(prisma),
          type: BULK_ORDER_ENQUIRY_TYPE,
          name: input.name,
          email: input.email,
          phone,
          status: 'New',
          ...details,
          ...buildBulkInquirySummary(details),
        },
      });
    } catch (err) {
      if (!isUniqueIdConflict(err) || attempt >= 2) throw err;
    }
  }

  emitEnquiryCreated({
    id: inquiry.id,
    type: inquiry.type,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    subject: inquiry.subject,
    message: inquiry.message,
    productId: inquiry.productId,
    productName: inquiry.productName,
    productSku: inquiry.productSku,
    quantity: inquiry.quantity,
    company: inquiry.company,
    status: inquiry.status,
    createdAt: inquiry.createdAt,
  });

  // Emails go out in the background so a slow mail server doesn't hold up the customer.
  sendBulkInquiryNotifications(inquiry).catch((err) => {
    logger.error(`Bulk inquiry ${inquiry.id}: notification failed — ${err.message}`);
  });

  return inquiry;
};

/**
 * Admin list of bulk order inquiries, newest first, with per-status counts for the filter tabs.
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} query
 */
export const listBulkOrderInquiries = async ({ status, search, page, limit } = {}) => {
  const where = { type: BULK_ORDER_ENQUIRY_TYPE };
  if (status) where.status = status;
  if (search) {
    const contains = { contains: search, mode: 'insensitive' };
    where.OR = ['id', 'name', 'email', 'phone', 'company', 'productName', 'productSku'].map((field) => ({ [field]: contains }));
  }
  const [total, grouped] = await Promise.all([
    prisma.enquiry.count({ where }),
    prisma.enquiry.groupBy({ by: ['status'], where: { type: BULK_ORDER_ENQUIRY_TYPE }, _count: { _all: true } }),
  ]);
  const meta = paginate(page, limit || 20, total);
  const data = await prisma.enquiry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: meta.skip,
    take: meta.take,
    select: {
      id: true, name: true, email: true, phone: true, company: true, requirements: true,
      productId: true, productName: true, productSku: true, quantity: true,
      status: true, createdAt: true, updatedAt: true,
      product: { select: { slug: true, images: true, isActive: true } },
    },
  });
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  return { ...paginatedResponse(data, meta), counts };
};

/** Moves a bulk inquiry along the sales pipeline. Only bulk inquiries can be changed here. */
export const updateBulkOrderInquiryStatus = async (id, status) => {
  const updated = await prisma.enquiry.updateMany({ where: { id, type: BULK_ORDER_ENQUIRY_TYPE }, data: { status } });
  if (!updated.count) throw new AppError('Bulk order inquiry not found', HTTP_STATUS.NOT_FOUND);
  return prisma.enquiry.findUnique({ where: { id } });
};
