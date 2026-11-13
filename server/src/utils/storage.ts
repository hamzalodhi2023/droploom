import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export const ensureStorageDirs = (): void => {
  mkdirSync(env.storageFilesDir, { recursive: true });
  mkdirSync(env.storageTmpDir, { recursive: true });
};

/** Guards against a tampered database row pointing outside the storage root. */
export const isInsideStorage = (absolutePath: string): boolean => {
  const root = path.resolve(env.uploadDir);
  const target = path.resolve(absolutePath);
  return target === root || target.startsWith(`${root}${path.sep}`);
};

export const resolveStoragePath = (storedFilename: string): string => {
  const safeName = path.basename(storedFilename);
  return path.join(env.storageFilesDir, safeName);
};
