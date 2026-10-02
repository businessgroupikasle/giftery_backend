import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { emitEnquiryCreated } from '../sockets/index.js';
import prisma from '../config/db.js';

// In-memory store fallback for enquiries
let fallbackEnquiries = [];

export const enquiryController = {
  // Public: Submit enquiry from contact form
  createEnquiry: async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;
      if (!name || !email || !message) {
        return sendError(res, 'Name, email, and message are required', HTTP_STATUS.BAD_REQUEST);
      }

      const year = new Date().getFullYear();
      let newEnquiry;
      try {
        if (prisma.enquiry) {
          const totalEnquiries = await prisma.enquiry.count();
          let readableId = `ENQ-${year}-${String(totalEnquiries + 1).padStart(4, '0')}`;
          let exists = await prisma.enquiry.findUnique({ where: { id: readableId } });
          let seq = totalEnquiries + 1;
          while (exists) {
            seq += 1;
            readableId = `ENQ-${year}-${String(seq).padStart(4, '0')}`;
            exists = await prisma.enquiry.findUnique({ where: { id: readableId } });
          }

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

      return sendSuccess(res, newEnquiry, 'Enquiry submitted successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      return sendError(res, err.message || 'Failed to submit enquiry', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  },

  // Admin/SuperAdmin: Get all enquiries
  getAllEnquiries: async (req, res) => {
    try {
      let dbEnquiries = [];
      try {
        if (prisma.enquiry) {
          dbEnquiries = await prisma.enquiry.findMany({
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
