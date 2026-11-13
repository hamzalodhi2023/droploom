import { z } from 'zod';

export const MAX_FILES_PER_REQUEST = 10;
export const MAX_FILENAME_LENGTH = 180;
export const MAX_EXTENSION_LENGTH = 16;

export const MIN_EXPIRY_MINUTES = 1;
export const MAX_EXPIRY_MINUTES = 7 * 24 * 60; // 10 080 minutes = 7 days

export const ExpirySchema = z.enum(['1h', '24h', '7d']);
export type ExpiryOption = z.infer<typeof ExpirySchema>;

export const MINUTES_BY_PRESET: Record<ExpiryOption, number> = {
  '1h': 60,
  '24h': 24 * 60,
  '7d': 7 * 24 * 60,
};

export const DEFAULT_EXPIRY_MINUTES = MINUTES_BY_PRESET['24h'];

/**
 * The request may send either a preset (`expiresIn`) or an explicit number of
 * minutes (`expiresInMinutes`). Integers only, 1–10080; the server always
 * computes the timestamp itself.
 */
export const UPLOAD_REQUEST_SCHEMA = z.object({
  expiresIn: ExpirySchema.optional(),
  expiresInMinutes: z.coerce
    .number()
    .int('Expiry must be a whole number of minutes')
    .min(MIN_EXPIRY_MINUTES, 'Expiry must be at least 1 minute')
    .max(MAX_EXPIRY_MINUTES, 'Expiry cannot exceed 10080 minutes (7 days)')
    .optional(),
});

export type UploadRequestInput = z.infer<typeof UPLOAD_REQUEST_SCHEMA>;

export const resolveExpiryMinutes = (input: UploadRequestInput): number => {
  if (input.expiresInMinutes !== undefined) return input.expiresInMinutes;
  if (input.expiresIn !== undefined) return MINUTES_BY_PRESET[input.expiresIn];
  return DEFAULT_EXPIRY_MINUTES;
};

/**
 * Strips directory components and control characters. The result is only used
 * for display and download headers — never as a filesystem path.
 */
export const sanitizeOriginalFilename = (filename: string): string => {
  const base = filename.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const safe = cleaned.length > 0 ? cleaned : 'file';
  return safe.slice(0, MAX_FILENAME_LENGTH);
};

/**
 * Any extension is accepted. The value is reduced to a short alphanumeric
 * suffix so it can be appended to a generated storage name safely.
 */
export const getSafeExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return '';

  const raw = filename.slice(lastDot + 1).toLowerCase();
  const safe = raw.replace(/[^a-z0-9]/g, '');
  return safe.slice(0, MAX_EXTENSION_LENGTH);
};
