import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { healthRouter } from './routes/health.routes.js';
import { logger } from './utils/logger.js';

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Same-origin/server-to-server requests (curl, tests) send no Origin header.
    if (!origin || origin === env.frontendOrigin) {
      callback(null, true);
      return;
    }
    logger.warn('Blocked CORS origin', { origin });
    callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  maxAge: 86400,
};

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  // Uploads use multipart, so JSON bodies stay small.
  app.use(express.json({ limit: '100kb' }));

  // Health check sits before the limiter so monitors are not rate limited.
  app.use('/api/health', healthRouter);
  app.use('/api', apiRateLimiter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
