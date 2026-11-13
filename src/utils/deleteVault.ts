import type { PublicUpload } from '../types';

/**
 * The upload response is the only place a delete token is ever sent. To let the
 * same browser delete its files after a refresh, the capability is kept in
 * IndexedDB — never in the database, never in a share URL.
 */
const DB_NAME = 'droploom-delete-vault';
const STORE = 'capabilities';
const DB_VERSION = 1;

export type DeleteCapability = {
  token: string;
  deleteToken: string;
  filename: string;
  savedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'token' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
};

const runRequest = async <T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> => {
  const database = await openDb();
  if (!database) return null;

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

/** Stores the delete capability for uploads returned by the API. */
export const saveDeleteCapabilities = async (uploads: readonly PublicUpload[]): Promise<void> => {
  await Promise.all(
    uploads
      .filter((upload): upload is PublicUpload & { deleteToken: string } =>
        typeof upload.deleteToken === 'string' && upload.deleteToken.length > 0,
      )
      .map((upload) =>
        runRequest('readwrite', (store) =>
          store.put({
            token: upload.token,
            deleteToken: upload.deleteToken,
            filename: upload.filename,
            savedAt: Date.now(),
          } satisfies DeleteCapability),
        ),
      ),
  );
};

/** Map of share token → delete token for uploads made by this browser. */
export const readDeleteCapabilities = async (): Promise<Map<string, string>> => {
  const records = await runRequest<DeleteCapability[]>('readonly', (store) => store.getAll());
  const map = new Map<string, string>();

  for (const record of records ?? []) {
    if (record && typeof record.token === 'string' && typeof record.deleteToken === 'string') {
      map.set(record.token, record.deleteToken);
    }
  }

  return map;
};

export const removeDeleteCapability = async (token: string): Promise<void> => {
  await runRequest('readwrite', (store) => store.delete(token));
};
