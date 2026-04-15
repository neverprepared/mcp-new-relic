#!/usr/bin/env node
import { startServer } from './server.js';
import { logger } from './logger.js';

startServer().catch((err: unknown) => {
  logger.error('Fatal error starting server', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
