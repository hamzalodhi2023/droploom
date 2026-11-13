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

/** A file the user has selected locally (nothing is uploaded). */
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

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
