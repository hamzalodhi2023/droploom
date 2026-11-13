import { createHash, randomBytes } from 'node:crypto';
import { access, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { getDatabase } from '../../database/connection.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { ensureStorageDirs, isInsideStorage, resolveStoragePath } from '../../utils/storage.js';
import {
  deleteUploadById,
  findCleanupCandidates,
  findRecentActiveUploads,
  findUploadByDeleteTokenHash,
  findUploadByToken,
  incrementDownloadCount,
  insertUpload,
  markPendingDelete,
  withTransaction,
} from './upload.repository.js';
import type { UploadRow } from './upload.repository.js';
import { getSafeExtension, sanitizeOriginalFilename } from './upload.validation.js';

export type UploadedTempFile = {
  path: string;
  originalname: string;
  size: number;
};

/** The delete capability is only ever returned in the upload response. */
export type PublicUpload = {
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
  deleteToken?: string;
};

export type FileRejection = {
  filename: string;
  code: string;
  message: string;
};

export type CreateUploadsResult = {
  uploads: PublicUpload[];
  rejections: FileRejection[];
};

const safeUnlink = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      logger.warn('Failed to delete file', { path: filePath, code });
    }
  }
};

/**
 * Deletes a stored file, reporting whether the filesystem actually let it go.
 * A missing file counts as removed (idempotent retries).
 */
const removeStoredFile = async (filePath: string): Promise<boolean> => {
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return true;
    logger.error('Could not remove stored file', { path: filePath, code });
    return false;
  }
};

/** Only a SHA-256 hash of the delete token is persisted. */
const hashDeleteToken = (deleteToken: string): string =>
  createHash('sha256').update(deleteToken, 'utf8').digest('hex');

export const discardTempUploads = async (
  tempFiles: readonly UploadedTempFile[],
): Promise<void> => {
  await Promise.all(tempFiles.map((file) => safeUnlink(file.path)));
};

export const toPublicUpload = (row: UploadRow): PublicUpload => ({
  token: row.share_token,
  filename: row.original_filename,
  size: row.file_size,
  mimeType: row.mime_type,
  extension: row.file_extension,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  downloadCount: row.download_count,
  sharePath: `/api/download/${row.share_token}`,
  downloadPath: `/api/download/${row.share_token}`,
});

type PreparedFile = {
  token: string;
  storedFilename: string;
  absolutePath: string;
  originalFilename: string;
  extension: string;
  size: number;
  tempPath: string;
  deleteToken: string;
  deleteTokenHash: string;
};

/**
 * Accepts any file type. Files are streamed to a temp directory by Multer,
 * then renamed into storage under a generated name and recorded in a single
 * transaction. Any database failure removes the files already moved.
 */
export const createUploads = async (
  tempFiles: readonly UploadedTempFile[],
  expiryMinutes: number,
): Promise<CreateUploadsResult> => {
  ensureStorageDirs();

  const prepared: PreparedFile[] = [];
  const rejections: FileRejection[] = [];

  for (const file of tempFiles) {
    const originalFilename = sanitizeOriginalFilename(file.originalname);
    const extension = getSafeExtension(originalFilename);

    if (file.size === 0) {
      rejections.push({
        filename: originalFilename,
        code: 'EMPTY_FILE',
        message: 'Empty files (0 bytes) cannot be shared',
      });
      continue;
    }

    if (file.size > env.maxFileSize) {
      rejections.push({
        filename: originalFilename,
        code: 'FILE_TOO_LARGE',
        message: `The file exceeds the ${Math.round(env.maxFileSize / (1024 * 1024))} MB limit`,
      });
      continue;
    }

    const token = randomBytes(24).toString('base64url');
    const deleteToken = randomBytes(32).toString('base64url');
    const storedFilename = extension ? `${token}.${extension}` : token;

    prepared.push({
      token,
      storedFilename,
      absolutePath: resolveStoragePath(storedFilename),
      originalFilename,
      extension,
      size: file.size,
      tempPath: file.path,
      deleteToken,
      deleteTokenHash: hashDeleteToken(deleteToken),
    });
  }

  const moved: string[] = [];

  try {
    for (const entry of prepared) {
      // Within the same storage root, rename is atomic.
      await rename(entry.tempPath, entry.absolutePath);
      moved.push(entry.absolutePath);
    }
  } catch (error) {
    await Promise.all(moved.map((absolutePath) => safeUnlink(absolutePath)));
    throw error;
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + expiryMinutes * 60_000);

  try {
    const database = getDatabase();
    withTransaction(database, () => {
      prepared.forEach((entry) => {
        insertUpload(database, {
          shareToken: entry.token,
          deleteTokenHash: entry.deleteTokenHash,
          originalFilename: entry.originalFilename,
          storedFilename: entry.storedFilename,
          mimeType: 'application/octet-stream',
          fileExtension: entry.extension,
          fileSize: entry.size,
          storagePath: entry.absolutePath,
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        });
      });
    });

    const uploads = prepared.map(
      (entry): PublicUpload => ({
        token: entry.token,
        filename: entry.originalFilename,
        size: entry.size,
        mimeType: 'application/octet-stream',
        extension: entry.extension,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        downloadCount: 0,
        sharePath: `/api/download/${entry.token}`,
        downloadPath: `/api/download/${entry.token}`,
        deleteToken: entry.deleteToken,
      }),
    );

    return { uploads, rejections };
  } catch (error) {
    await Promise.all(moved.map((absolutePath) => safeUnlink(absolutePath)));
    logger.error('Upload transaction failed — files removed', {
      error: error instanceof Error ? error.message : String(error),
      fileCount: moved.length,
    });
    throw AppError.internal('Could not save the upload. Please try again.');
  } finally {
    await discardTempUploads(tempFiles);
  }
};

export const getUploadByToken = (token: string): PublicUpload => {
  const row = findUploadByToken(getDatabase(), token);
  if (!row || row.pending_delete === 1) {
    throw AppError.notFound('This link does not exist');
  }
  return toPublicUpload(row);
};

export const getRecentUploads = (limit = 6): PublicUpload[] =>
  findRecentActiveUploads(getDatabase(), new Date().toISOString(), limit).map(toPublicUpload);

export type ResolvedDownload = {
  row: UploadRow;
  absolutePath: string;
};

export const resolveDownload = async (token: string): Promise<ResolvedDownload> => {
  const row = findUploadByToken(getDatabase(), token);
  if (!row) {
    throw AppError.notFound('This link does not exist');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw AppError.expired('This link has expired');
  }

  // A file whose one-time download completed (or whose deletion is awaiting a
  // retry) is no longer shareable.
  if (row.pending_delete === 1) {
    throw AppError.notFound('This file is no longer available');
  }

  if (!isInsideStorage(row.storage_path)) {
    logger.error('Refused to serve file outside storage root', { token });
    throw AppError.notFound('This file is not available');
  }

  const absolutePath = path.resolve(row.storage_path);
  try {
    await access(absolutePath);
  } catch {
    logger.error('Stored file missing on disk', { token, path: absolutePath });
    throw AppError.notFound('The file for this link is no longer available');
  }

  return { row, absolutePath };
};

export const registerDownload = (id: number): void => {
  incrementDownloadCount(getDatabase(), id);
};

const finalizing = new Map<string, Promise<boolean>>();

/** In-flight transfers per token, so deletion waits for every reader. */
const activeDownloads = new Map<string, number>();

export const beginDownload = (token: string): void => {
  activeDownloads.set(token, (activeDownloads.get(token) ?? 0) + 1);
};

export const endDownload = (token: string): void => {
  const remaining = (activeDownloads.get(token) ?? 1) - 1;
  if (remaining <= 0) {
    activeDownloads.delete(token);
    return;
  }
  activeDownloads.set(token, remaining);
};

const finalizeOnce = async (token: string): Promise<boolean> => {
  const database = getDatabase();
  const row = findUploadByToken(database, token);
  if (!row) return false;

  // Another transfer is still reading this file; the last one deletes it.
  if ((activeDownloads.get(token) ?? 0) > 0) return false;

  if (!isInsideStorage(row.storage_path)) {
    logger.error('Refused to delete file outside storage root', { token });
    deleteUploadById(database, row.id);
    return true;
  }

  const removed = await removeStoredFile(row.storage_path);
  if (!removed) {
    // Keep the record so the cleanup job can retry; sharing is already closed.
    markPendingDelete(database, row.id);
    logger.warn('One-time deletion deferred until storage allows it', { id: row.id });
    return false;
  }

  deleteUploadById(database, row.id);
  logger.info('One-time upload deleted after a completed download', { id: row.id });
  return true;
};

/**
 * Called only after a download stream completed successfully. Concurrent
 * callers for the same token share one deletion attempt, and later callers
 * simply find no row — so parallel downloads cannot corrupt state.
 */
export const finalizeDownloadByToken = (token: string): Promise<boolean> => {
  const inFlight = finalizing.get(token);
  if (inFlight) return inFlight;

  const task = finalizeOnce(token).finally(() => {
    finalizing.delete(token);
  });

  finalizing.set(token, task);
  return task;
};

export type DeletedUpload = { filename: string };

/**
 * Permanently deletes a file using its private delete capability. The public
 * share token cannot be used here: only a hash of the delete token is stored.
 */
export const deleteUploadByDeleteToken = async (deleteToken: string): Promise<DeletedUpload> => {
  if (deleteToken.length < 16) {
    throw AppError.notFound('This delete link is not valid');
  }

  const database = getDatabase();
  const row = findUploadByDeleteTokenHash(database, hashDeleteToken(deleteToken));
  if (!row) {
    throw AppError.notFound('This delete link is not valid, or the file was already deleted');
  }

  const removed = isInsideStorage(row.storage_path)
    ? await removeStoredFile(row.storage_path)
    : true;

  if (!removed) {
    // Keep the row (and expose the failure) so the retry job can finish later.
    markPendingDelete(database, row.id);
    throw AppError.internal('Could not delete the stored file. Please try again.');
  }

  deleteUploadById(database, row.id);
  logger.info('Upload deleted', { id: row.id });

  return { filename: row.original_filename };
};

export type CleanupResult = { removed: number; failed: number };

export const cleanupExpiredUploads = async (limit = 200): Promise<CleanupResult> => {
  const database = getDatabase();
  const expired = findCleanupCandidates(database, new Date().toISOString(), limit);

  let removed = 0;
  let failed = 0;

  for (const row of expired) {
    try {
      const fileRemoved = isInsideStorage(row.storage_path)
        ? await removeStoredFile(row.storage_path)
        : true;

      if (!fileRemoved) {
        markPendingDelete(database, row.id);
        failed += 1;
        continue;
      }

      deleteUploadById(database, row.id);
      removed += 1;
    } catch (error) {
      failed += 1;
      logger.error('Failed to clean up expired upload', {
        id: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (removed > 0 || failed > 0) {
    logger.info('Expired upload cleanup finished', { removed, failed });
  }

  return { removed, failed };
};
