import type { DatabaseSync } from 'node:sqlite';

export type UploadRow = {
  id: number;
  share_token: string;
  delete_token_hash: string | null;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  expires_at: string;
  download_count: number;
};

export type NewUploadRow = {
  shareToken: string;
  deleteTokenHash: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  expiresAt: string;
};

const asRow = (value: unknown): UploadRow | undefined =>
  value === undefined || value === null ? undefined : (value as UploadRow);

export const insertUpload = (db: DatabaseSync, input: NewUploadRow): number => {
  const result = db
    .prepare(
      `INSERT INTO uploads (
         share_token, delete_token_hash, original_filename, stored_filename, mime_type,
         file_extension, file_size, storage_path, created_at, expires_at, download_count
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      input.shareToken,
      input.deleteTokenHash,
      input.originalFilename,
      input.storedFilename,
      input.mimeType,
      input.fileExtension,
      input.fileSize,
      input.storagePath,
      input.createdAt,
      input.expiresAt,
    );

  return Number(result.lastInsertRowid);
};

export const findUploadByToken = (db: DatabaseSync, token: string): UploadRow | undefined =>
  asRow(
    db
      .prepare('SELECT * FROM uploads WHERE share_token = ? LIMIT 1')
      .get(token),
  );

export const findUploadByDeleteTokenHash = (
  db: DatabaseSync,
  tokenHash: string,
): UploadRow | undefined =>
  asRow(
    db
      .prepare('SELECT * FROM uploads WHERE delete_token_hash = ? LIMIT 1')
      .get(tokenHash),
  );

export const incrementDownloadCount = (db: DatabaseSync, id: number): void => {
  db.prepare('UPDATE uploads SET download_count = download_count + 1 WHERE id = ?').run(id);
};

export const findExpiredUploads = (
  db: DatabaseSync,
  nowIso: string,
  limit = 100,
): UploadRow[] => {
  const rows = db
    .prepare('SELECT * FROM uploads WHERE expires_at <= ? ORDER BY expires_at ASC LIMIT ?')
    .all(nowIso, limit);

  return rows.map((row) => row as UploadRow);
};

export const deleteUploadById = (db: DatabaseSync, id: number): void => {
  db.prepare('DELETE FROM uploads WHERE id = ?').run(id);
};

export const findRecentActiveUploads = (
  db: DatabaseSync,
  nowIso: string,
  limit = 6,
): UploadRow[] => {
  const rows = db
    .prepare(
      `SELECT * FROM uploads
       WHERE expires_at > ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ?`,
    )
    .all(nowIso, limit);

  return rows.map((row) => row as UploadRow);
};

export const withTransaction = <T>(db: DatabaseSync, work: () => T): T => {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};
