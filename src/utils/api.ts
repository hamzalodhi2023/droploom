import type { PublicUpload, UploadRejection, UploadResponse } from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiErrorBody = {
  error?: { code?: unknown; message?: unknown; details?: unknown };
};

const parseJson = (raw: string): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const toApiError = (status: number, rawBody: string): ApiError => {
  const body = parseJson(rawBody) as ApiErrorBody | null;

  // The dev proxy answers 502/503/504 with an empty body when the API is down.
  if (body === null && [502, 503, 504].includes(status)) {
    return new ApiError(
      'Could not reach the upload server. Check that the API is running and try again.',
      status,
      'SERVER_UNAVAILABLE',
    );
  }

  const code = typeof body?.error?.code === 'string' ? body.error.code : `HTTP_${status}`;
  const message =
    typeof body?.error?.message === 'string'
      ? body.error.message
      : status === 413
        ? 'Each file must be 100 MB or smaller.'
        : `The server responded with status ${status}.`;

  return new ApiError(message, status, code, body?.error?.details);
};

const isUploadResponse = (value: unknown): value is UploadResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { uploads?: unknown; rejections?: unknown };
  return Array.isArray(candidate.uploads);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Turns server-side per-file rejections into typed objects. */
export const toRejections = (error: ApiError): UploadRejection[] => {
  if (!Array.isArray(error.details)) return [];
  return error.details.filter(
    (item): item is UploadRejection =>
      isRecord(item) &&
      typeof item.filename === 'string' &&
      typeof item.code === 'string' &&
      typeof item.message === 'string',
  );
};

export type UploadFilesArgs = {
  files: readonly File[];
  expiresInMinutes: number;
  onProgress?: (percent: number) => void;
};

/**
 * Uploads real File objects as multipart/form-data via XHR (fetch has no
 * upload progress events in browsers). Resolves only for a 2xx response.
 */
export const uploadFiles = ({
  files,
  expiresInMinutes,
  onProgress,
}: UploadFilesArgs): Promise<UploadResponse> =>
  new Promise<UploadResponse>((resolve, reject) => {
    if (files.length === 0) {
      reject(new ApiError('Select at least one file to upload.', 400, 'NO_FILES'));
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    formData.append('expiresInMinutes', String(expiresInMinutes));

    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/uploads`);
    request.responseType = 'text';

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    request.addEventListener('load', () => {
      const body = parseJson(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        if (!isUploadResponse(body)) {
          reject(
            new ApiError('The server returned an unexpected response.', request.status, 'BAD_RESPONSE'),
          );
          return;
        }
        onProgress?.(100);
        resolve(body);
        return;
      }

      reject(toApiError(request.status, request.responseText));
    });

    request.addEventListener('error', () => {
      reject(
        new ApiError(
          'Could not reach the server. Check that the API is running and try again.',
          0,
          'NETWORK_ERROR',
        ),
      );
    });

    request.addEventListener('timeout', () => {
      reject(new ApiError('The upload timed out. Please try again.', 0, 'TIMEOUT'));
    });

    request.addEventListener('abort', () => {
      reject(new ApiError('Upload cancelled.', 0, 'ABORTED'));
    });

    request.send(formData);
  });

export const fetchRecentUploads = async (): Promise<PublicUpload[]> => {
  const response = await fetch(`${API_BASE}/uploads/recent`, {
    headers: { Accept: 'application/json' },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw toApiError(response.status, raw);
  }

  const body = parseJson(raw) as { uploads?: unknown } | null;
  if (!body || !Array.isArray(body.uploads)) {
    return [];
  }

  return body.uploads.filter(
    (item): item is PublicUpload =>
      isRecord(item) && typeof item.token === 'string' && typeof item.filename === 'string',
  );
};

/**
 * Permanently deletes an upload using its private delete capability. The
 * public share token is not accepted by this endpoint.
 */
export const deleteUpload = async (deleteToken: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/uploads/${encodeURIComponent(deleteToken)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (response.ok) return;

  const raw = await response.text();
  throw toApiError(response.status, raw);
};

/** Absolute URL for a share path returned by the API. */
export const toAbsoluteUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
};
