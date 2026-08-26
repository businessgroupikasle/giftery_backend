import { sendSuccess } from '../utils/response.js';

const MOCK_CORPORATE_ORDERS = [];
const MOCK_QUOTE_REQUESTS = [];
const MOCK_ARTWORK_APPROVALS = [];

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

