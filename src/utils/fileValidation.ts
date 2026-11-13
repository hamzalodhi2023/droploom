import { formatBytes } from '../types';
import type { FileValidationCode } from '../types';

/**
 * Droploom accepts any file type. The frontend only checks size, emptiness and
 * duplicate selection; the server performs its own independent validation.
 */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const MAX_FILE_SIZE_LABEL = '100 MB';

/** Lower-case extension without the dot, or '' when the name has none. */
export const getFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
};

/** Stable identity for duplicate detection (same file picked twice). */
export const getFileFingerprint = (file: File): string =>
  `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;

export type FileValidationResult =
  | { ok: true; extension: string }
  | { ok: false; code: FileValidationCode; message: string };

type ValidateFileArgs = {
  file: File;
  /** Fingerprints already in the current selection. */
  existingFingerprints: ReadonlySet<string>;
};

export const validateFileForSelection = ({
  file,
  existingFingerprints,
}: ValidateFileArgs): FileValidationResult => {
  const extension = getFileExtension(file.name);

  if (file.size === 0) {
    return {
      ok: false,
      code: 'empty',
      message: 'The file is empty (0 bytes), so there is nothing to share.',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: 'too-large',
      message: `${formatBytes(file.size)} exceeds the ${MAX_FILE_SIZE_LABEL} limit.`,
    };
  }

  if (existingFingerprints.has(getFileFingerprint(file))) {
    return {
      ok: false,
      code: 'duplicate',
      message: 'This file is already in your selection.',
    };
  }

  return { ok: true, extension };
};
