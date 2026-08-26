import { getStoreSettings } from '../controllers/settingController.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

/**
 * Middleware that blocks public mutating business actions (such as placing orders)
 * when Storefront Maintenance Mode is enabled by Admin.
 *
 * Admin users and Admin APIs bypass this check completely.
 */
export const checkMaintenanceMode = (req, res, next) => {
  const settings = getStoreSettings();

  if (settings && settings.maintenanceMode === true) {
    // If request has authenticated user, check if they are an administrator
    const userRole = req.user?.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'STORE_ADMIN';

    if (!isAdmin) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE || 503).json({
        success: false,
        maintenanceMode: true,
        message: 'The store is currently under maintenance. Please try again later.',
      });
    }
  }

  next();
};
