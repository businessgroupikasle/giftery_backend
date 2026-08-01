import { sendSuccess } from '../utils/response.js';

let storeSettings = {
  storeName: 'GIFTERYS',
  storeTagline: 'PREMIUM GIFTS, LASTING IMPRESSIONS',
  supportEmail: 'support@giftery.com',
  supportPhone: '+91 98765 43210',
  currency: 'INR (₹)',
  taxRate: 18,
  require2FA: true,
  allowRegistrations: true,
  sessionTimeout: 60,
  smtpHost: 'smtp.giftery.com',
  smtpPort: 587,
  senderName: 'GIFTERYS Order Notifications',
};

export const settingController = {
  getSettings: (req, res) => {
    sendSuccess(res, storeSettings, 'Settings retrieved');
  },
  updateSettings: (req, res) => {
    storeSettings = { ...storeSettings, ...req.body };
    sendSuccess(res, storeSettings, 'Settings updated successfully');
  },
};
