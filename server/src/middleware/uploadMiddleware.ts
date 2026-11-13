import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { MAX_FILES_PER_REQUEST } from '../modules/uploads/upload.validation.js';
import { ensureStorageDirs } from '../utils/storage.js';

/**
 * Files are streamed straight to a temporary directory on disk — never buffered
 * in memory — then validated and renamed into permanent storage.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureStorageDirs();
    callback(null, env.storageTmpDir);
  },
  filename: (_req, _file, callback) => {
    callback(null, `${randomUUID()}.part`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSize,
    files: MAX_FILES_PER_REQUEST,
    fields: 5,
  },
});

export const uploadFilesMiddleware = upload.array('files', MAX_FILES_PER_REQUEST);
