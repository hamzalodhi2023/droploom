import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import supertest from 'supertest';

const workDir = mkdtempSync(path.join(os.tmpdir(), 'droploom-test-'));
const fixturesDir = path.join(import.meta.dirname, 'fixtures');

// Configuration must exist before the app modules are imported (env is parsed
// once at module load).
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_PATH = path.join(workDir, 'test.sqlite');
process.env.UPLOAD_DIR = path.join(workDir, 'storage');
process.env.MAX_FILE_SIZE = String(1024 * 1024); // 1 MB keeps the oversize test fast
process.env.RATE_LIMIT_API_MAX = '1000';
process.env.RATE_LIMIT_UPLOAD_MAX = '1000';
process.env.RATE_LIMIT_DOWNLOAD_MAX = '1000';
process.env.CLEANUP_INTERVAL_MINUTES = '60';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { closeDatabase, getDatabase, initDatabase } = await import(
  '../src/database/connection.js'
);
const { cleanupExpiredUploads } = await import('../src/modules/uploads/upload.service.js');

const storageFilesDir = path.join(workDir, 'storage', 'files');
const storageTmpDir = path.join(workDir, 'storage', 'tmp');

type ApiUpload = {
  token: string;
  filename: string;
  size: number;
  sharePath: string;
  downloadPath: string;
  expiresAt: string;
  downloadCount: number;
};

type UploadBody = {
  uploads: ApiUpload[];
  rejections: Array<{ filename: string; code: string; message: string }>;
};

type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

const api = supertest(createApp());

const fixture = (name: string): string => path.join(fixturesDir, name);

const uploadOne = (filePath: string, expiresIn = '24h') =>
  api.post('/api/uploads').attach('files', filePath).field('expiresIn', expiresIn);

const downloadBuffer = async (token: string) => {
  const response = await api
    .get(`/api/download/${token}`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });

  const body = Buffer.from(response.body as Buffer);
  let json: unknown = null;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    // Binary download payloads are not JSON.
  }

  return { response, body, json };
};

before(() => {
  mkdirSync(storageFilesDir, { recursive: true });
  mkdirSync(storageTmpDir, { recursive: true });
  initDatabase(process.env.DATABASE_PATH as string);
});

after(() => {
  closeDatabase();
  rmSync(workDir, { recursive: true, force: true });
});

describe('Droploom API', () => {
  it('reports a healthy database', async () => {
    const response = await api.get('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.database.status, 'ok');
  });

  describe('uploading files', () => {
    it('accepts a real PDF and stores it outside the original filename', async () => {
      const response = await uploadOne(fixture('sample.pdf'), '1h');
      assert.equal(response.status, 201);

      const body = response.body as UploadBody;
      assert.equal(body.uploads.length, 1);

      const upload = body.uploads[0];
      assert.ok(upload);
      assert.equal(upload.filename, 'sample.pdf');
      assert.equal(upload.size, readFileSync(fixture('sample.pdf')).length);
      assert.equal(upload.downloadCount, 0);
      assert.ok(upload.token.length >= 32, 'token should be long and unguessable');
      assert.equal(upload.sharePath, `/api/download/${upload.token}`);

      // The stored name is generated, not the client filename.
      assert.notEqual(upload.token, 'sample.pdf');
      const stored = readdirSync(storageFilesDir);
      assert.ok(stored.some((name) => name === `${upload.token}.pdf`));
      assert.ok(!stored.includes('sample.pdf'));

      // Responses must never expose the internal storage path.
      assert.ok(!JSON.stringify(body).includes(workDir));
    });

    it('accepts a TXT file', async () => {
      const response = await uploadOne(fixture('notes.txt'));
      assert.equal(response.status, 201);
      assert.equal((response.body as UploadBody).uploads[0]?.filename, 'notes.txt');
    });

    it('accepts a ZIP file', async () => {
      const response = await uploadOne(fixture('archive.zip'));
      assert.equal(response.status, 201);
      assert.equal((response.body as UploadBody).uploads[0]?.filename, 'archive.zip');
    });

    it('accepts several files in one request with a distinct token each', async () => {
      const response = await api
        .post('/api/uploads')
        .attach('files', fixture('sample.pdf'))
        .attach('files', fixture('notes.txt'))
        .attach('files', fixture('archive.zip'))
        .field('expiresIn', '24h');

      assert.equal(response.status, 201);
      const body = response.body as UploadBody;
      assert.equal(body.uploads.length, 3);

      const tokens = new Set(body.uploads.map((upload) => upload.token));
      assert.equal(tokens.size, 3);
      assert.deepEqual(
        body.uploads.map((upload) => upload.filename).sort(),
        ['archive.zip', 'notes.txt', 'sample.pdf'],
      );
    });

    it('generates a different token for two uploads of the same file', async () => {
      const first = await uploadOne(fixture('notes.txt'));
      const second = await uploadOne(fixture('notes.txt'));
      const firstToken = (first.body as UploadBody).uploads[0]?.token;
      const secondToken = (second.body as UploadBody).uploads[0]?.token;

      assert.ok(firstToken && secondToken);
      assert.notEqual(firstToken, secondToken);
    });

    it('keeps valid files when another file in the request is rejected', async () => {
      const exePath = path.join(workDir, 'setup.exe');
      writeFileSync(exePath, Buffer.from('MZ\x90\x00fake executable payload'));

      const response = await api
        .post('/api/uploads')
        .attach('files', fixture('sample.pdf'))
        .attach('files', exePath)
        .field('expiresIn', '24h');

      assert.equal(response.status, 201);
      const body = response.body as UploadBody;
      assert.equal(body.uploads.length, 1);
      assert.equal(body.rejections.length, 1);
      assert.equal(body.rejections[0]?.code, 'UNSUPPORTED_TYPE');
    });
  });

  describe('rejecting bad input', () => {
    it('rejects an unsupported EXE file', async () => {
      const exePath = path.join(workDir, 'malware.exe');
      writeFileSync(exePath, Buffer.from('MZ\x90\x00payload'));

      const response = await uploadOne(exePath);
      assert.equal(response.status, 400);

      const body = response.body as ErrorBody;
      assert.equal(body.error.code, 'ALL_FILES_REJECTED');
    });

    it('rejects an executable renamed to .pdf', async () => {
      const response = await uploadOne(fixture('not-really.pdf'));
      assert.equal(response.status, 400);

      const details = (response.body as ErrorBody).error.details;
      assert.ok(Array.isArray(details));
      const first = details[0] as { code?: string } | undefined;
      assert.equal(first?.code, 'CONTENT_MISMATCH');
    });

    it('rejects a file larger than the configured limit', async () => {
      const bigPath = path.join(workDir, 'big.pdf');
      const oversized = Buffer.alloc(1024 * 1024 + 1024, 0x20);
      oversized.write('%PDF-1.4\n', 0, 'utf8');
      writeFileSync(bigPath, oversized);

      const response = await uploadOne(bigPath);
      assert.equal(response.status, 413);
      assert.equal((response.body as ErrorBody).error.code, 'PAYLOAD_TOO_LARGE');
    });

    it('leaves no orphaned files behind after failed uploads', async () => {
      const filesBefore = readdirSync(storageFilesDir).length;
      const tmpBefore = readdirSync(storageTmpDir).length;

      const exePath = path.join(workDir, 'orphan-check.exe');
      writeFileSync(exePath, Buffer.from('MZ\x90\x00payload'));
      const bigPath = path.join(workDir, 'orphan-check.pdf');
      writeFileSync(bigPath, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1024 * 1024)]));

      const rejected = await uploadOne(exePath);
      const tooLarge = await uploadOne(bigPath);

      assert.equal(rejected.status, 400);
      assert.equal(tooLarge.status, 413);
      assert.equal(readdirSync(storageFilesDir).length, filesBefore);
      assert.equal(readdirSync(storageTmpDir).length, tmpBefore);
    });

    it('rejects an invalid expiry value', async () => {
      const response = await uploadOne(fixture('sample.pdf'), 'never');
      assert.equal(response.status, 400);
      assert.equal((response.body as ErrorBody).error.code, 'BAD_REQUEST');
    });
  });

  describe('sharing and downloading', () => {
    it('returns public metadata without internal paths', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), '7d');
      const token = (uploaded.body as UploadBody).uploads[0]?.token;
      assert.ok(token);

      const response = await api.get(`/api/files/${token}`);
      assert.equal(response.status, 200);

      const file = (response.body as { file: ApiUpload }).file;
      assert.equal(file.filename, 'sample.pdf');
      assert.ok(file.expiresAt);
      assert.ok(!JSON.stringify(response.body).includes(workDir));
    });

    it('streams the original bytes back with a safe attachment header', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), '1h');
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const { response, body } = await downloadBuffer(upload.token);

      assert.equal(response.status, 200);
      assert.deepEqual(body, readFileSync(fixture('sample.pdf')));
      assert.match(String(response.headers['content-disposition']), /^attachment;/);
      assert.match(String(response.headers['content-disposition']), /sample\.pdf/);
      assert.equal(String(response.headers['content-type']), 'application/octet-stream');
    });

    it('increments the download counter', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'));
      const token = (uploaded.body as UploadBody).uploads[0]?.token;
      assert.ok(token);

      await downloadBuffer(token);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const metadata = await api.get(`/api/files/${token}`);
      assert.equal((metadata.body as { file: ApiUpload }).file.downloadCount, 1);
    });

    it('returns 404 for an unknown token', async () => {
      const response = await api.get('/api/download/not-a-real-token');
      assert.equal(response.status, 404);
      assert.equal((response.body as ErrorBody).error.code, 'NOT_FOUND');
    });

    it('refuses an expired link and deletes its file during cleanup', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'));
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const storedPath = path.join(storageFilesDir, `${upload.token}.pdf`);
      assert.ok(existsSync(storedPath));

      getDatabase()
        .prepare('UPDATE uploads SET expires_at = ? WHERE share_token = ?')
        .run(new Date(Date.now() - 60_000).toISOString(), upload.token);

      const expired = await downloadBuffer(upload.token);
      assert.equal(expired.response.status, 410);
      assert.equal((expired.json as ErrorBody).error.code, 'EXPIRED');

      const metadata = await api.get(`/api/files/${upload.token}`);
      assert.ok(metadata.body);

      const result = await cleanupExpiredUploads();
      assert.ok(result.removed >= 1);

      const row = getDatabase()
        .prepare('SELECT id FROM uploads WHERE share_token = ?')
        .get(upload.token);
      assert.equal(row, undefined);
      assert.equal(existsSync(storedPath), false);
    });

    it('lists recent active uploads and hides expired ones', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'));
      const token = (uploaded.body as UploadBody).uploads[0]?.token;
      assert.ok(token);

      const response = await api.get('/api/uploads/recent');
      assert.equal(response.status, 200);
      const uploads = (response.body as { uploads: ApiUpload[] }).uploads;
      assert.ok(uploads.some((upload) => upload.token === token));
      assert.ok(uploads.length <= 6);
    });
  });

  describe('request hardening', () => {
    it('only echoes CORS headers for the configured frontend origin', async () => {
      const allowed = await api
        .get('/api/uploads/recent')
        .set('Origin', 'http://localhost:5173');
      assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');

      const blocked = await api
        .get('/api/uploads/recent')
        .set('Origin', 'https://evil.example');
      assert.equal(blocked.headers['access-control-allow-origin'], undefined);
    });

    it('returns JSON 404 for unknown API routes', async () => {
      const response = await api.get('/api/nope');
      assert.equal(response.status, 404);
      assert.equal((response.body as ErrorBody).error.code, 'NOT_FOUND');
    });
  });
});
