import { normalizeContactPhone } from '../utils/phone.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emitEnquiryCreated } from '../sockets/index.js';
import { nextEnquiryId } from '../utils/enquiryId.js';
import { sendEnquiryNotifications } from '../helpers/email.js';
import { logger } from '../config/logger.js';
import { BULK_ORDER_ENQUIRY_TYPE, createBulkOrderInquiry, listBulkOrderInquiries, updateBulkOrderInquiryStatus } from '../services/bulkInquiryService.js';
import prisma from '../config/db.js';

// In-memory store fallback for enquiries
let fallbackEnquiries = [];

export const enquiryController = {
  // Public: Submit enquiry from contact form
  createEnquiry: async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      if (!name || !email || !message) {
        return sendError(res, 'Name, email, and message are required', HTTP_STATUS.BAD_REQUEST);
      }
      let phone;
      try {
        phone = normalizeContactPhone(req.body.phone);
      } catch (err) {
        return sendError(res, err.message, HTTP_STATUS.BAD_REQUEST);
      }

      const year = new Date().getFullYear();
      let newEnquiry;
      try {
        if (prisma.enquiry) {
          const readableId = await nextEnquiryId(prisma);

          newEnquiry = await prisma.enquiry.create({
            data: {
              id: readableId,
              name,
              email,
              phone: phone || 'N/A',
              subject: subject || 'General Inquiry',
              message,
              status: 'New',
            },
          });
        }
      } catch (dbErr) {
        console.warn('Prisma enquiry save fallback to memory:', dbErr.message);
      }

      if (!newEnquiry) {
        const readableId = `ENQ-${year}-${String(fallbackEnquiries.length + 1).padStart(4, '0')}`;
        newEnquiry = {
          id: readableId,
          displayId: readableId,
          name,
          email,
          phone: phone || 'N/A',
          subject: subject || 'General Inquiry',
          message,
          status: 'New',
          createdAt: new Date().toISOString(),
        };
        fallbackEnquiries.unshift(newEnquiry);
      }

      // Emit Socket.IO event only after database / memory creation succeeds
      emitEnquiryCreated({
        id: newEnquiry.id,
        name: newEnquiry.name,
        email: newEnquiry.email,
        phone: newEnquiry.phone,
        subject: newEnquiry.subject || 'General Inquiry',
        message: newEnquiry.message,
        status: newEnquiry.status || 'New',
        createdAt: newEnquiry.createdAt || new Date().toISOString(),
      });

      // Quote and catalogue requests email the admin and the customer. Sent in the
      // background so a slow or failing mail server never blocks the saved enquiry.
      sendEnquiryNotifications(newEnquiry).catch((err) => {
        logger.error(`Enquiry ${newEnquiry.id}: notification failed — ${err.message}`);
      });

      return sendSuccess(res, newEnquiry, 'Enquiry submitted successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      return sendError(res, err.message || 'Failed to submit enquiry', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  },

  // Public: Bulk order inquiry from the product details page (body validated by bulkOrderInquirySchema)
  createBulkOrderInquiry: async (req, res) => {
    const inquiry = await createBulkOrderInquiry(req.body);
    return sendSuccess(
      res,
      {
        id: inquiry.id,
        productId: inquiry.productId,
        productName: inquiry.productName,
        productSku: inquiry.productSku,
        quantity: inquiry.quantity,
        createdAt: inquiry.createdAt,
      },
      'Bulk order inquiry submitted successfully',
      HTTP_STATUS.CREATED
    );
  },

  // Admin: bulk order inquiries for the dashboard "Bulk Orders" tab (query validated by bulkOrderListQuerySchema)
  listBulkOrders: async (req, res) => {
    const result = await listBulkOrderInquiries(req.query);
    return sendSuccess(res, result, 'Bulk order inquiries fetched successfully');
  },

  // Admin: move a bulk inquiry along the pipeline (body validated by bulkOrderStatusSchema)
  updateBulkOrderStatus: async (req, res) => {
    const inquiry = await updateBulkOrderInquiryStatus(req.params.id, req.body.status);
    return sendSuccess(res, inquiry, 'Bulk order inquiry status updated');
  },

  // Admin/SuperAdmin: Get all enquiries
  getAllEnquiries: async (req, res) => {
    try {
      let dbEnquiries = [];
      try {
        if (prisma.enquiry) {
          // Bulk order inquiries have their own dashboard tab.
          dbEnquiries = await prisma.enquiry.findMany({
            where: { type: { not: BULK_ORDER_ENQUIRY_TYPE } },
            orderBy: { createdAt: 'desc' },
          });
        }
      } catch (dbErr) {
        console.warn('Prisma fetch enquiries fallback to memory:', dbErr.message);
      }

      // Return DB enquiries
      const listToReturn = dbEnquiries.length > 0 ? dbEnquiries : fallbackEnquiries;

      const resultList = listToReturn.map((e, index) => {
        const year = e.createdAt ? new Date(e.createdAt).getFullYear() || 2026 : 2026;
        let displayId = e.id;
        // If e.id is a CUID (e.g. cmudyrdkg000gzvm7anlm1ig5) or legacy timestamp
        if (e.id && (!e.id.startsWith('ENQ-') || e.id.length > 15)) {
          displayId = `ENQ-${year}-${String(listToReturn.length - index).padStart(4, '0')}`;
        }
        return {
          ...e,
          id: e.id,
          displayId,
          enquiryNumber: displayId,
          createdAt: e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
        };
      });

      return sendSuccess(res, resultList, 'Enquiries fetched successfully');
    } catch (err) {
      return sendError(res, err.message || 'Failed to fetch enquiries', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  },

  // Admin/SuperAdmin: Update enquiry status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      let updated;
      try {
        if (prisma.enquiry) {
          let target = await prisma.enquiry.findUnique({ where: { id } });
          if (!target) {
            const all = await prisma.enquiry.findMany();
            target = all.find(e => e.id === id);
          }
          if (target) {
            updated = await prisma.enquiry.update({
              where: { id: target.id },
              data: { status },
            });
          }
        }
      } catch (dbErr) {
        console.warn('Prisma enquiry update fallback to memory:', dbErr.message);
      }

      if (!updated) {
        const item = fallbackEnquiries.find((e) => e.id === id);
        if (item) {
          item.status = status || item.status;
          updated = item;
        }
      }

      if (!updated) {
        return sendError(res, 'Enquiry not found', HTTP_STATUS.NOT_FOUND);
      }

      return sendSuccess(res, updated, 'Enquiry status updated');
    } catch (err) {
      return sendError(res, err.message || 'Failed to update enquiry status', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  },

  // Admin/SuperAdmin: Delete enquiry record
  deleteEnquiry: async (req, res) => {
    try {
      const { id } = req.params;
      try {
        if (prisma.enquiry) {
          let target = await prisma.enquiry.findUnique({ where: { id } });
          if (!target) {
            const all = await prisma.enquiry.findMany();
            target = all.find(e => e.id === id);
          }
          if (target) {
            await prisma.enquiry.delete({ where: { id: target.id } });
          }
        }
      } catch (dbErr) {
        console.warn('Prisma enquiry delete fallback:', dbErr.message);
      }

      fallbackEnquiries = fallbackEnquiries.filter(e => e.id !== id);
      return sendSuccess(res, null, 'Enquiry deleted successfully');
    } catch (err) {
      return sendError(res, err.message || 'Failed to delete enquiry', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  },
};
