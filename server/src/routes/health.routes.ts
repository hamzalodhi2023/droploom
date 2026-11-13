import { Router } from 'express';
import { getDatabase } from '../database/connection.js';
import { LATEST_SCHEMA_VERSION } from '../database/schema.js';
import { logger } from '../utils/logger.js';

export const healthRouter = Router();

type DatabaseHealth = {
  status: 'ok' | 'error';
  schemaVersion?: number;
  uploads?: number;
  message?: string;
};

const checkDatabase = (): DatabaseHealth => {
  try {
    const db = getDatabase();
    const versionRow = db.prepare('PRAGMA user_version').get() as
      | { user_version?: number | bigint }
      | undefined;
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM uploads').get() as
      | { count?: number | bigint }
      | undefined;

    return {
      status: 'ok',
      schemaVersion: Number(versionRow?.user_version ?? 0),
      uploads: Number(countRow?.count ?? 0),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Health check: database unavailable', { error: message });
    return { status: 'error', message };
  }
};

healthRouter.get('/', (_req, res) => {
  const database = checkDatabase();
  const healthy = database.status === 'ok';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'droploom-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: { ...database, expectedSchemaVersion: LATEST_SCHEMA_VERSION },
  });
});
