import { HTTP_STATUS } from '../shared/constants/httpStatus.js';

export class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.details = details;
  }
}

export class FileUploadError extends AppError {
  constructor(message, details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.details = details;
  }
}

export class BatchOperationError extends AppError {
  constructor(message, results = { success: [], failed: [] }) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    this.results = results;
  }
}

export class InventoryError extends AppError {
  constructor(message, productId = null) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.productId = productId;
  }
}

export class ConflictError extends AppError {
  constructor(message, resource = null) {
    super(message, HTTP_STATUS.CONFLICT);
    this.resource = resource;
  }
}

export class NotFoundError extends AppError {
  constructor(message, resource = null) {
    super(message, HTTP_STATUS.NOT_FOUND);
    this.resource = resource;
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}
