import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, initDatabase } from './database/connection.js';
import { logger } from './utils/logger.js';

const main = (): void => {
  initDatabase(env.databasePath);

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info('Droploom API listening', {
      port: env.port,
      env: env.nodeEnv,
      frontendOrigin: env.frontendOrigin,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info('Shutting down', { signal });
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });

    // Do not hang forever if connections refuse to drain.
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
};

main();
