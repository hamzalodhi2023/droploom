import type { DatabaseSync } from 'node:sqlite';
import { logger } from '../utils/logger.js';

type Migration = {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
};

/**
 * Append-only list of migrations. `PRAGMA user_version` records the highest
 * applied version, so no extra bookkeeping table is required.
 */
const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'create_uploads_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS uploads (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          share_token       TEXT    NOT NULL UNIQUE,
          original_filename TEXT    NOT NULL,
          stored_filename   TEXT    NOT NULL UNIQUE,
          mime_type         TEXT    NOT NULL,
          file_extension    TEXT    NOT NULL,
          file_size         INTEGER NOT NULL CHECK (file_size > 0),
          storage_path      TEXT    NOT NULL,
          created_at        TEXT    NOT NULL,
          expires_at        TEXT    NOT NULL,
          download_count    INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_uploads_share_token ON uploads (share_token);
        CREATE INDEX IF NOT EXISTS idx_uploads_expires_at  ON uploads (expires_at);
        CREATE INDEX IF NOT EXISTS idx_uploads_created_at  ON uploads (created_at);
      `);
    },
  },
  {
    version: 2,
    name: 'add_upload_delete_token_hash',
    up: (db) => {
      // Nullable: rows created before delete support keep NULL and cannot be
      // deleted without a capability (SQLite unique indexes ignore NULLs).
      db.exec(`
        ALTER TABLE uploads ADD COLUMN delete_token_hash TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_delete_token_hash
          ON uploads (delete_token_hash);
      `);
    },
  },
  {
    version: 3,
    name: 'add_upload_pending_delete',
    up: (db) => {
      // Set once a one-time download completed (or a deletion could not remove
      // the file). Rows with this flag are hidden from sharing and retried by
      // the cleanup job until the storage file is gone.
      db.exec(`
        ALTER TABLE uploads ADD COLUMN pending_delete INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_uploads_pending_delete ON uploads (pending_delete);
      `);
    },
  },
];

const readUserVersion = (db: DatabaseSync): number => {
  const row = db.prepare('PRAGMA user_version').get() as
    | { user_version?: number | bigint }
    | undefined;
  const value = row?.user_version ?? 0;
  return typeof value === 'bigint' ? Number(value) : Number(value);
};

export const LATEST_SCHEMA_VERSION = migrations.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0,
);

export const runMigrations = (db: DatabaseSync): number => {
  let current = readUserVersion(db);
  const pending = migrations.filter((migration) => migration.version > current);

  for (const migration of pending) {
    db.exec('BEGIN');
    try {
      migration.up(db);
      // The version comes from this module's constant list, never user input.
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
      current = migration.version;
      logger.info('Applied database migration', {
        version: migration.version,
        name: migration.name,
      });
    } catch (error) {
      db.exec('ROLLBACK');
      logger.error('Database migration failed', {
        version: migration.version,
        name: migration.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return current;
};
