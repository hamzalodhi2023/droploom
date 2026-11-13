import { formatBytes } from '../types';
import type { FileValidationCode } from '../types';

export const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'zip', 'rar'] as const;

export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const MAX_FILE_SIZE_LABEL = '100 MB';

/** Value for the file input's accept attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

const ACCEPTED_LOOKUP: ReadonlySet<string> = new Set<string>(ACCEPTED_EXTENSIONS);

/** Lower-case extension without the dot, or '' when the name has none. */
export const getFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
};

export const isAcceptedExtension = (extension: string): boolean =>
  ACCEPTED_LOOKUP.has(extension);

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

  if (!isAcceptedExtension(extension)) {
    return {
      ok: false,
      code: 'unsupported-type',
      message: extension
        ? `.${extension} is not supported. Use PDF, DOC, DOCX, TXT, ZIP or RAR.`
        : 'Files without an extension are not supported. Use PDF, DOC, DOCX, TXT, ZIP or RAR.',
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
