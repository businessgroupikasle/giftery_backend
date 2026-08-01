import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

// In-memory store initialized with demo enquiries
let enquiries = [
  {
    id: 'enq-101',
    name: 'Tech Solutions Pvt. Ltd.',
    email: 'contact@techsolutions.com',
    phone: '+91 98765 43210',
    subject: 'Bulk Corporate Gifts Inquiry',
    message: 'We are looking to order 200 customized executive gift hampers for our annual Diwali company event. Please share product catalog and pricing.',
    status: 'New',
    createdAt: '2026-08-01T10:15:00.000Z',
  },
  {
    id: 'enq-102',
    name: 'Rahul Verma',
    email: 'rahul.verma@gmail.com',
    phone: '+91 91234 56789',
    subject: 'Personalized Leather Notebook Engraving',
    message: 'Can I add individual employee names on each leather notebook in gold foil embossing?',
    status: 'In Progress',
    createdAt: '2026-08-01T08:30:00.000Z',
  },
  {
    id: 'enq-103',
    name: 'ABC Corporation',
    email: 'procurement@abccorp.in',
    phone: '+91 99887 76655',
    subject: 'Custom Branding Quote',
    message: 'Requesting quote for 500 customized thermal water bottles with laser engraved company logo.',
    status: 'Resolved',
    createdAt: '2026-07-31T14:20:00.000Z',
  },
];

export const enquiryController = {
  // Public: Submit enquiry from contact form
  createEnquiry: (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return sendError(res, 'Name, email, and message are required', HTTP_STATUS.BAD_REQUEST);
    }

    const newEnquiry = {
      id: `enq-${Date.now()}`,
      name,
      email,
      phone: phone || 'N/A',
      subject: subject || 'General Inquiry',
      message,
      status: 'New',
      createdAt: new Date().toISOString(),
    };

    enquiries.unshift(newEnquiry);
    sendSuccess(res, newEnquiry, 'Enquiry submitted successfully', HTTP_STATUS.CREATED);
  },

  // Admin/SuperAdmin: Get all enquiries
  getAllEnquiries: (req, res) => {
    sendSuccess(res, enquiries, 'Enquiries fetched successfully');
  },

  // Admin/SuperAdmin: Update enquiry status
  updateStatus: (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const item = enquiries.find((e) => e.id === id);
    if (!item) {
      return sendError(res, 'Enquiry not found', HTTP_STATUS.NOT_FOUND);
    }
    item.status = status || item.status;
    sendSuccess(res, item, 'Enquiry status updated');
  },
};
