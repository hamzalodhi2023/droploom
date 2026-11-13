import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { cleanupExpiredUploads } from './upload.service.js';

/**
 * Runs cleanup once at startup and then on an interval. Failures are logged and
 * never crash the process.
 */
export const startExpiryCleanup = (): (() => void) => {
  const run = (): void => {
    void cleanupExpiredUploads().catch((error: unknown) => {
      logger.error('Expired upload cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  run();

  const timer = setInterval(run, env.cleanupIntervalMinutes * 60_000);
  timer.unref();

  logger.info('Expiry cleanup scheduled', {
    intervalMinutes: env.cleanupIntervalMinutes,
  });

  return () => clearInterval(timer);
};
