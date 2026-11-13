import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { logger } from '../utils/logger.js';
import { runMigrations } from './schema.js';

let database: DatabaseSync | null = null;

export const openDatabase = (databasePath: string): DatabaseSync => {
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');

  runMigrations(db);
  logger.info('Database ready', { path: databasePath });
  return db;
};

export const initDatabase = (databasePath: string): DatabaseSync => {
  if (database) return database;
  database = openDatabase(databasePath);
  return database;
};

export const getDatabase = (): DatabaseSync => {
  if (!database) {
    throw new Error('Database has not been initialised. Call initDatabase() first.');
  }
  return database;
};

export const closeDatabase = (): void => {
  if (!database) return;
  database.close();
  database = null;
  logger.info('Database connection closed');
};

/** Used by tests to swap in a fresh database. */
export const resetDatabaseForTests = (): void => {
  if (database) database.close();
  database = null;
};
