import { Router } from 'express';
import { downloadRateLimiter, uploadRateLimiter } from '../../middleware/rateLimit.js';
import { uploadFilesMiddleware } from '../../middleware/uploadMiddleware.js';
import {
  deleteUpload,
  getDownload,
  getFileMetadata,
  getRecentUploadsHandler,
  postUploads,
} from './upload.controller.js';

export const uploadsRouter = Router();

uploadsRouter.post('/uploads', uploadRateLimiter, uploadFilesMiddleware, postUploads);
uploadsRouter.get('/uploads/recent', getRecentUploadsHandler);
uploadsRouter.get('/files/:token', downloadRateLimiter, getFileMetadata);
uploadsRouter.get('/download/:token', downloadRateLimiter, getDownload);
uploadsRouter.delete('/uploads/:deleteToken', uploadRateLimiter, deleteUpload);
