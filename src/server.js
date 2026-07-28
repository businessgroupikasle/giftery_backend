import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initSockets } from './sockets/index.js';
import prisma from './config/db.js';

const server = http.createServer(app);

// ── Socket.IO ───────────────────────────────────────────────────
initSockets(server);

// ── Start ───────────────────────────────────────────────────────
server.listen(env.PORT, async () => {
  try {
    await prisma.$connect();
    logger.info(`✅ Database connected`);
  } catch (err) {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  logger.info(`🚀 Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`📡 API docs available at http://localhost:${env.PORT}/api/v1/health`);
});

// ── Graceful Shutdown ───────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`\n${signal} received. Graceful shutdown...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server and DB closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  shutdown('UnhandledRejection');
});

