import { sendSuccess } from '../utils/response.js';

const MOCK_CORPORATE_ORDERS = [
  { id: 'CORP-101', company: 'TechCorp Global', items: 'Custom Onboarding Kits x 150', budget: '$18,500', status: 'In Production', date: '2026-07-28' },
  { id: 'CORP-102', company: 'Apex Financial', items: 'Engraved Executive Pens & Journals x 80', budget: '$9,200', status: 'Approved', date: '2026-07-30' },
  { id: 'CORP-103', company: 'Vanguard Media', items: 'Custom Luxury Gift Boxes x 200', budget: '$24,000', status: 'Pending Review', date: '2026-08-01' },
];

const MOCK_QUOTE_REQUESTS = [
  { id: 'QR-501', name: 'Sarah Jenkins', company: 'Nexus Logistics', email: 's.jenkins@nexuslogistics.com', quantity: 500, deadline: '2026-09-01', status: 'New Request' },
  { id: 'QR-502', name: 'David Miller', company: 'Horizon Tech', email: 'dmiller@horizontech.io', quantity: 120, deadline: '2026-08-20', status: 'Quote Sent' },
];

const MOCK_ARTWORK_APPROVALS = [
  { id: 'ART-201', orderId: 'CORP-101', title: 'TechCorp Engraved Logo Vector', file: 'techcorp_vector_v2.ai', status: 'Approved by Client', uploadDate: '2026-07-29' },
  { id: 'ART-202', orderId: 'CORP-103', title: 'Vanguard Foil Stamp Emboss', file: 'vanguard_gold_stamp.pdf', status: 'Pending Approval', uploadDate: '2026-08-01' },
];

export const corporateController = {
  getOrders: (req, res) => {
    sendSuccess(res, MOCK_CORPORATE_ORDERS, 'Corporate orders fetched');
  },
  getQuotes: (req, res) => {
    sendSuccess(res, MOCK_QUOTE_REQUESTS, 'Quote requests fetched');
  },
  getArtworks: (req, res) => {
    sendSuccess(res, MOCK_ARTWORK_APPROVALS, 'Artwork approvals fetched');
  },
};
