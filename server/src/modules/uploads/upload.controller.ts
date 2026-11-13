import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { buildContentDisposition } from '../../utils/contentDisposition.js';
import {
  beginDownload,
  createUploads,
  deleteUploadByDeleteToken,
  discardTempUploads,
  endDownload,
  finalizeDownloadByToken,
  getRecentUploads,
  getUploadByToken,
  registerDownload,
  resolveDownload,
} from './upload.service.js';
import type { UploadedTempFile } from './upload.service.js';
import { resolveExpiryMinutes, UPLOAD_REQUEST_SCHEMA } from './upload.validation.js';

const readToken = (req: Request): string => {
  const token = req.params.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw AppError.badRequest('A share token is required');
  }
  return token;
};

const toTempFile = (file: Express.Multer.File): UploadedTempFile => ({
  path: file.path,
  originalname: file.originalname,
  size: file.size,
});

export const postUploads: RequestHandler = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];

  if (files.length === 0) {
    throw AppError.badRequest(
      'No files were received. Send one or more files in the "files" field.',
    );
  }

  const parsedBody = UPLOAD_REQUEST_SCHEMA.safeParse(req.body);
  if (!parsedBody.success) {
    // Files were already streamed to the temp directory; remove them.
    await discardTempUploads(files.map(toTempFile));
    const message = parsedBody.error.issues[0]?.message ?? 'Invalid expiry value';
    throw AppError.badRequest(message, {
      allowedMinutes: '1-10080',
      allowedPresets: ['1h', '24h', '7d'],
    });
  }

  const expiryMinutes = resolveExpiryMinutes(parsedBody.data);
  const result = await createUploads(files.map(toTempFile), expiryMinutes);

  if (result.uploads.length === 0) {
    res.status(400).json({
      error: {
        code: 'ALL_FILES_REJECTED',
        message: 'None of the selected files were accepted.',
        details: result.rejections,
      },
    });
    return;
  }

  res.status(201).json({
    uploads: result.uploads,
    rejections: result.rejections,
  });
};

export const getFileMetadata: RequestHandler = (req, res) => {
  const upload = getUploadByToken(readToken(req));
  res.json({ file: upload });
};

export const getRecentUploadsHandler: RequestHandler = (_req, res) => {
  res.json({ uploads: getRecentUploads() });
};

export const getDownload: RequestHandler = async (req, res) => {
  const token = readToken(req);
  const { row, absolutePath } = await resolveDownload(token);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(row.file_size));
  res.setHeader('Content-Disposition', buildContentDisposition(row.original_filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  const stream = createReadStream(absolutePath);
  beginDownload(token);

  stream.on('open', () => {
    try {
      registerDownload(row.id);
    } catch (error) {
      logger.error('Could not increment download count', {
        id: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  try {
    // Resolves only when the whole file was flushed to the client. An aborted
    // download or a client disconnect rejects, leaving the file untouched.
    await pipeline(stream, res);
  } catch (error) {
    logger.warn('Download did not complete; file kept', {
      token,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not read the stored file' },
      });
    } else if (!res.writableEnded) {
      res.destroy();
    }
    return;
  } finally {
    endDownload(token);
  }

  // One-time link: only a completed transfer consumes the file.
  await finalizeDownloadByToken(token);
};

export const deleteUpload: RequestHandler = async (req, res) => {
  const deleteToken = req.params.deleteToken;
  if (typeof deleteToken !== 'string' || deleteToken.length === 0) {
    throw AppError.badRequest('A delete token is required');
  }

  const deleted = await deleteUploadByDeleteToken(deleteToken);
  res.json({ deleted: true, filename: deleted.filename });
};
