import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Initialises Socket.IO on the HTTP server.
 * @param {import('http').Server} httpServer
 */
export const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        logger.info(`Socket ${socket.id} joined room user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  // Attach io to global so controllers can emit
  global.io = io;

  logger.info('🔌 Socket.IO initialised');
  return io;
};

/**
 * Emits an order status update to the user's socket room.
 * @param {string} userId
 * @param {object} data
 */
export const emitOrderUpdate = (userId, data) => {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('order:update', data);
  }
};

/**
 * Emits a real-time event when a new order is placed in the database.
 * @param {object} order
 */
export const emitOrderCreated = (order) => {
  if (global.io) {
    global.io.emit('order:created', order);
  }
};

/**
 * Emits a real-time event when a customer submits an enquiry.
 * @param {object} enquiry
 */
export const emitEnquiryCreated = (enquiry) => {
  if (global.io) {
    global.io.emit('enquiry:created', enquiry);
  }
};

/**
 * Emits a real-time event when a new customer registers.
 * @param {object} customer
 */
export const emitCustomerCreated = (customer) => {
  if (global.io) {
    global.io.emit('customer:created', customer);
  }
};

/**
 * Emits a real-time event when Maintenance Mode is updated.
 * @param {{ maintenanceMode: boolean }} data
 */
export const emitMaintenanceUpdated = (data) => {
  if (global.io) {
    global.io.emit('maintenance:updated', data);
  }
};

