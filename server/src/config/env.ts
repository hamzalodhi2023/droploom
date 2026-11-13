import path from 'node:path';
import { z } from 'zod';
import { loadEnvFile } from '../utils/envFile.js';

// Load `.env` if present. Values in the file win over ambient variables so
// local development is reproducible.
const envFile = path.resolve(process.cwd(), '.env');
loadEnvFile(envFile);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/droploom.sqlite'),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_DOWNLOAD_MAX: z.coerce.number().int().positive().default(120),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

/** Absolute paths keep file operations independent of the working directory. */
const resolveFromCwd = (value: string): string =>
  path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  databasePath: resolveFromCwd(raw.DATABASE_PATH),
  uploadDir: resolveFromCwd(raw.UPLOAD_DIR),
  maxFileSize: raw.MAX_FILE_SIZE,
  frontendOrigin: raw.FRONTEND_ORIGIN,
  cleanupIntervalMinutes: raw.CLEANUP_INTERVAL_MINUTES,
  rateLimits: {
    api: raw.RATE_LIMIT_API_MAX,
    upload: raw.RATE_LIMIT_UPLOAD_MAX,
    download: raw.RATE_LIMIT_DOWNLOAD_MAX,
  },
} as const;

export type Env = typeof env;
