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
  /** Lower-case extension without the dot, e.g. "pdf". */
  extension: string;
  /** Identity used to detect duplicate selections. */
  fingerprint: string;
}

export type FileValidationCode = 'unsupported-type' | 'too-large' | 'duplicate';

export interface FileValidationError {
  id: string;
  fileName: string;
  code: FileValidationCode;
  message: string;
}

/* ---------- API contracts ---------- */

export type ExpiryOption = '1h' | '24h' | '7d';

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

export const EXPIRY_OPTIONS: ReadonlyArray<{
  value: ExpiryOption;
  label: string;
  description: string;
}> = [
  { value: '1h', label: '1 hour', description: 'Disappears quickly' },
  { value: '24h', label: '24 hours', description: 'The usual choice' },
  { value: '7d', label: '7 days', description: 'For longer review cycles' },
];

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
