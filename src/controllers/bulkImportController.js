import { bulkImportService } from '../services/bulkImportService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export const bulkImportController = {
  /**
   * GET /api/v1/products/bulk/template
   * Downloads the standardized Excel template for bulk product import
   */
  downloadTemplate: async (req, res, next) => {
    try {
      const buffer = await bulkImportService.generateTemplate();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="product_bulk_import_template.xlsx"'
      );
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/products/bulk/validate
   * Parses uploaded Excel file and returns validation results per row
   */
  validateExcel: async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer) {
        return sendError(res, 'Please upload a valid Excel (.xlsx) or ZIP file (.zip)', HTTP_STATUS.BAD_REQUEST);
      }

      const result = await bulkImportService.parseAndValidate(req.file.buffer, req.file.originalname);
      return sendSuccess(res, result, 'File processed and validated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/products/bulk/import
   * Imports valid products into PostgreSQL using existing product creation logic
   */
  confirmImport: async (req, res, next) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return sendError(res, 'No valid product rows provided for import', HTTP_STATUS.BAD_REQUEST);
      }

      const result = await bulkImportService.executeBulkImport(products);
      return sendSuccess(
        res,
        result,
        `Successfully imported ${result.importedCount} products into database`,
        HTTP_STATUS.CREATED
      );
    } catch (err) {
      next(err);
    }
  },
};
