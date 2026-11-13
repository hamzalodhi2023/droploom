import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const buildLimiter = (max: number) =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    },
  });

/** Broad limit applied to every API route. */
export const apiRateLimiter = buildLimiter(env.rateLimits.api);

/** Tighter limit for expensive upload requests. */
export const uploadRateLimiter = buildLimiter(env.rateLimits.upload);

/** Limit for link lookups and downloads. */
export const downloadRateLimiter = buildLimiter(env.rateLimits.download);
