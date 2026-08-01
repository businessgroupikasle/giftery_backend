import { sendSuccess } from '../utils/response.js';

const MOCK_REPORTS = {
  monthlyRevenue: '$148,250.00',
  orderFulfillmentRate: '98.4%',
  topCategory: 'Corporate Gifts',
  recentSalesGrowth: '+24.5%',
  monthlyBreakdown: [
    { month: 'Jan', revenue: 24000 },
    { month: 'Feb', revenue: 32000 },
    { month: 'Mar', revenue: 28000 },
    { month: 'Apr', revenue: 41000 },
    { month: 'May', revenue: 49000 },
    { month: 'Jun', revenue: 58000 },
    { month: 'Jul', revenue: 64000 },
  ],
};

export const reportController = {
  getSummary: (req, res) => sendSuccess(res, MOCK_REPORTS, 'Analytics summary fetched'),
};
