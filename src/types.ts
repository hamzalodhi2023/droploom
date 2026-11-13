export type ThemeMode = 'light' | 'dark';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  uploadDate: Date;
  expiryDate: Date | null;
  expiryEnabled: boolean;
  sharingLink: string;
  status: 'pending' | 'ready' | 'expired';
}

export interface NavLink {
  label: string;
  href: string;
}

export interface FilePreview {
  file: File;
  preview: string | null;
}

/** A file the user has selected locally, before it is uploaded. */
export interface SelectedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  sizeFormatted: string;
  /** Lower-case extension without the dot, e.g. "pdf". May be empty. */
  extension: string;
  /** Identity used to detect duplicate selections. */
  fingerprint: string;
}

export type FileValidationCode = 'empty' | 'too-large' | 'duplicate';

export interface FileValidationError {
  id: string;
  fileName: string;
  code: FileValidationCode;
  message: string;
}

/* ---------- API contracts ---------- */

export type ExpiryOption = '1h' | '24h' | '7d';

export const MIN_EXPIRY_MINUTES = 1;
export const MAX_EXPIRY_MINUTES = 7 * 24 * 60; // 10 080

export const EXPIRY_PRESETS: ReadonlyArray<{
  value: ExpiryOption;
  label: string;
  minutes: number;
  description: string;
}> = [
  { value: '1h', label: '1 hour', minutes: 60, description: 'Disappears quickly' },
  { value: '24h', label: '24 hours', minutes: 24 * 60, description: 'The usual choice' },
  { value: '7d', label: '7 days', minutes: 7 * 24 * 60, description: 'For longer review cycles' },
];

export type ExpiryMode = ExpiryOption | 'custom';

/**
 * Converts the selector state into a whole number of minutes, or null when the
 * value is not a valid integer inside the allowed range.
 */
export function resolveExpiryMinutes(
  mode: ExpiryMode,
  customMinutes: string,
): number | null {
  if (mode !== 'custom') {
    const preset = EXPIRY_PRESETS.find((option) => option.value === mode);
    return preset ? preset.minutes : null;
  }

  const trimmed = customMinutes.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isInteger(value)) return null;
  if (value < MIN_EXPIRY_MINUTES || value > MAX_EXPIRY_MINUTES) return null;

  return value;
}

export interface PublicUpload {
  token: string;
  filename: string;
  size: number;
  mimeType: string;
  extension: string;
  createdAt: string;
  expiresAt: string;
  downloadCount: number;
  sharePath: string;
  downloadPath: string;
  /** Private capability returned only in the upload response. */
  deleteToken?: string;
}

export interface UploadRejection {
  filename: string;
  code: string;
  message: string;
}

export interface UploadResponse {
  uploads: PublicUpload[];
  rejections: UploadRejection[];
}

/** "Expires in 5 minutes", "Expires in 2 hours", "Expires in 3 days". */
export function formatExpiryMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Expiry not set';
  if (minutes === 1) return 'Expires in 1 minute';
  if (minutes < 60) return `Expires in ${Math.round(minutes)} minutes`;

  const hours = minutes / 60;
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10;
    return `Expires in ${rounded % 1 === 0 ? rounded.toFixed(0) : rounded} ${
      rounded === 1 ? 'hour' : 'hours'
    }`;
  }

  const days = hours / 24;
  const rounded = Math.round(days * 10) / 10;
  return `Expires in ${rounded % 1 === 0 ? rounded.toFixed(0) : rounded} ${
    rounded === 1 ? 'day' : 'days'
  }`;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
