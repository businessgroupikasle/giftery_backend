import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';
import { emitMaintenanceUpdated } from '../sockets/index.js';

const getSettingsFilePath = () => {
  const baseDir = path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
  return path.join(baseDir, 'store_settings.json');
};

const DEFAULT_SETTINGS = {
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
  maintenanceMode: false,
};

let storeSettings = { ...DEFAULT_SETTINGS };

// Load settings from disk if available
try {
  const filePath = getSettingsFilePath();
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    storeSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('⚠️ Could not load settings from disk, using defaults:', e.message);
}

const saveSettingsToDisk = (settings) => {
  try {
    const filePath = getSettingsFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️ Could not save settings to disk:', e.message);
  }
};

export const getStoreSettings = () => storeSettings;

export const settingController = {
  getSettings: (req, res) => {
    sendSuccess(res, storeSettings, 'Settings retrieved');
  },
  updateSettings: (req, res) => {
    const prevMaintenance = storeSettings.maintenanceMode;
    storeSettings = { ...storeSettings, ...req.body };
    saveSettingsToDisk(storeSettings);

    if (req.body.maintenanceMode !== undefined && req.body.maintenanceMode !== prevMaintenance) {
      emitMaintenanceUpdated({ maintenanceMode: Boolean(storeSettings.maintenanceMode) });
    }

    sendSuccess(res, storeSettings, 'Settings updated successfully');
  },
};

