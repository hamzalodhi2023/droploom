import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { createServer, get as httpGet } from 'node:http';
import type { AddressInfo } from 'node:net';
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
process.env.MAX_FILE_SIZE = String(100 * 1024 * 1024); // the real 100 MB limit
process.env.RATE_LIMIT_API_MAX = '5000';
process.env.RATE_LIMIT_UPLOAD_MAX = '5000';
process.env.RATE_LIMIT_DOWNLOAD_MAX = '5000';
process.env.CLEANUP_INTERVAL_MINUTES = '1';
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
  createdAt: string;
  downloadCount: number;
  deleteToken?: string;
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

const tempFile = (name: string, contents: Buffer | string): string => {
  const filePath = path.join(workDir, name);
  writeFileSync(filePath, contents);
  return filePath;
};

/** Minimal but valid PNG (1x1 transparent pixel). */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

const MP4_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypmp42', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('mp42isom', 'ascii'),
  Buffer.alloc(64, 0x11),
]);

const uploadOne = (filePath: string, fields: Record<string, string> = {}) => {
  const request = api.post('/api/uploads').attach('files', filePath);
  for (const [key, value] of Object.entries(fields)) {
    request.field(key, value);
  }
  return request;
};

const uploadWithMinutes = (filePath: string, minutes: string) =>
  uploadOne(filePath, { expiresInMinutes: minutes });

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

const storedFileFor = (upload: ApiUpload): string => {
  const row = getDatabase()
    .prepare('SELECT storage_path FROM uploads WHERE share_token = ?')
    .get(upload.token) as { storage_path: string } | undefined;
  assert.ok(row, 'upload row should exist');
  return row.storage_path;
};

const countRows = (): number => {
  const row = getDatabase().prepare('SELECT COUNT(*) AS count FROM uploads').get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A real listening server, needed to abort a download mid-stream. */
const startServer = async (): Promise<{ close: () => Promise<void>; port: number }> => {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

const rowFor = (token: string): { pending_delete: number; download_count: number } | undefined =>
  getDatabase()
    .prepare('SELECT pending_delete, download_count FROM uploads WHERE share_token = ?')
    .get(token) as { pending_delete: number; download_count: number } | undefined;

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
    assert.equal(response.body.database.schemaVersion, 3);
  });

  describe('universal file formats', () => {
    it('accepts a PDF and keeps the original filename', async () => {
      const response = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '60' });
      assert.equal(response.status, 201);

      const upload = (response.body as UploadBody).uploads[0];
      assert.ok(upload);
      assert.equal(upload.filename, 'sample.pdf');
      assert.equal(upload.size, readFileSync(fixture('sample.pdf')).length);
      assert.ok(upload.token.length >= 32);

      const stored = readdirSync(storageFilesDir);
      assert.ok(stored.includes(`${upload.token}.pdf`));
      assert.ok(!stored.includes('sample.pdf'));
      assert.ok(!JSON.stringify(response.body).includes(workDir));
    });

    it('accepts a PNG image and preserves its bytes', async () => {
      const filePath = tempFile('pixel.png', PNG_BYTES);
      const response = await uploadOne(filePath, { expiresInMinutes: '60' });
      assert.equal(response.status, 201);

      const upload = (response.body as UploadBody).uploads[0];
      assert.ok(upload);
      assert.equal(upload.filename, 'pixel.png');

      const { body } = await downloadBuffer(upload.token);
      assert.deepEqual(body, PNG_BYTES);
    });

    it('accepts an MP4 video and preserves its bytes', async () => {
      const filePath = tempFile('clip.mp4', MP4_BYTES);
      const response = await uploadOne(filePath, { expiresInMinutes: '60' });
      assert.equal(response.status, 201);

      const upload = (response.body as UploadBody).uploads[0];
      assert.ok(upload);

      const { body } = await downloadBuffer(upload.token);
      assert.deepEqual(body, MP4_BYTES);
    });

    it('accepts a ZIP archive', async () => {
      const response = await uploadOne(fixture('archive.zip'), { expiresInMinutes: '60' });
      assert.equal(response.status, 201);
      assert.equal((response.body as UploadBody).uploads[0]?.filename, 'archive.zip');
    });

    it('accepts JavaScript and TypeScript source files', async () => {
      const js = tempFile('app.js', 'export const answer = 42;\n');
      const ts = tempFile('types.ts', 'export type Id = string;\n');

      const response = await api
        .post('/api/uploads')
        .attach('files', js)
        .attach('files', ts)
        .field('expiresInMinutes', '60');

      assert.equal(response.status, 201);
      assert.deepEqual(
        (response.body as UploadBody).uploads.map((upload) => upload.filename).sort(),
        ['app.js', 'types.ts'],
      );
    });

    it('accepts an EXE binary', async () => {
      const exe = tempFile('installer.exe', Buffer.from('MZ\x90\x00fake windows binary'));
      const response = await uploadOne(exe, { expiresInMinutes: '60' });
      assert.equal(response.status, 201);
      assert.equal((response.body as UploadBody).uploads[0]?.filename, 'installer.exe');
    });

    it('accepts an unknown extension', async () => {
      const weird = tempFile('dataset.qzx7', Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]));
      const response = await uploadOne(weird, { expiresInMinutes: '60' });
      assert.equal(response.status, 201);
      assert.equal((response.body as UploadBody).uploads[0]?.filename, 'dataset.qzx7');
    });

    it('accepts application/octet-stream binaries', async () => {
      const response = await api
        .post('/api/uploads')
        .attach('files', Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00]), {
          filename: 'blob.bin',
          contentType: 'application/octet-stream',
        })
        .field('expiresInMinutes', '60');

      assert.equal(response.status, 201);
      const upload = (response.body as UploadBody).uploads[0];
      assert.ok(upload);
      assert.equal(upload.filename, 'blob.bin');

      const { body } = await downloadBuffer(upload.token);
      assert.deepEqual(body, Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00]));
    });

    it('accepts a file with no extension', async () => {
      const bare = tempFile('Makefile', 'all:\n\techo hi\n');
      const response = await uploadOne(bare, { expiresInMinutes: '60' });
      assert.equal(response.status, 201);
      assert.equal((response.body as UploadBody).uploads[0]?.filename, 'Makefile');
    });

    it('rejects empty (0 byte) files deliberately', async () => {
      const empty = tempFile('nothing.dat', Buffer.alloc(0));
      const response = await uploadOne(empty, { expiresInMinutes: '60' });

      assert.equal(response.status, 400);
      const details = (response.body as ErrorBody).error.details;
      assert.ok(Array.isArray(details));
      assert.equal((details[0] as { code?: string }).code, 'EMPTY_FILE');
    });

    it('rejects a file above the 100 MB limit', async () => {
      const bigPath = path.join(workDir, 'huge.bin');
      writeFileSync(bigPath, Buffer.alloc(1024));
      truncateSync(bigPath, 100 * 1024 * 1024 + 1024); // sparse 100 MB + 1 KB

      const response = await uploadOne(bigPath, { expiresInMinutes: '60' });
      assert.equal(response.status, 413);
      assert.equal((response.body as ErrorBody).error.code, 'PAYLOAD_TOO_LARGE');
      rmSync(bigPath, { force: true });
    });

    it('keeps valid files when another file is empty', async () => {
      const empty = tempFile('blank.txt', Buffer.alloc(0));
      const response = await api
        .post('/api/uploads')
        .attach('files', fixture('sample.pdf'))
        .attach('files', empty)
        .field('expiresInMinutes', '60');

      assert.equal(response.status, 201);
      const body = response.body as UploadBody;
      assert.equal(body.uploads.length, 1);
      assert.equal(body.rejections[0]?.code, 'EMPTY_FILE');
    });

    it('leaves no orphaned files after failed uploads', async () => {
      const filesBefore = readdirSync(storageFilesDir).length;
      const tmpBefore = readdirSync(storageTmpDir).length;

      const empty = tempFile('orphan.txt', Buffer.alloc(0));
      const rejection = await uploadOne(empty, { expiresInMinutes: '60' });

      assert.equal(rejection.status, 400);
      assert.equal(readdirSync(storageFilesDir).length, filesBefore);
      assert.equal(readdirSync(storageTmpDir).length, tmpBefore);
    });
  });

  describe('multiple files and sharing', () => {
    it('accepts several files in one request with a distinct token each', async () => {
      const response = await api
        .post('/api/uploads')
        .attach('files', fixture('sample.pdf'))
        .attach('files', fixture('notes.txt'))
        .attach('files', fixture('archive.zip'))
        .field('expiresInMinutes', '1440');

      assert.equal(response.status, 201);
      const uploads = (response.body as UploadBody).uploads;
      assert.equal(uploads.length, 3);
      assert.equal(new Set(uploads.map((upload) => upload.token)).size, 3);
    });

    it('returns public metadata without paths or delete tokens', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const response = await api.get(`/api/files/${upload.token}`);
      assert.equal(response.status, 200);

      const file = (response.body as { file: ApiUpload }).file;
      assert.equal(file.filename, 'sample.pdf');
      assert.ok(!('deleteToken' in file), 'metadata must not expose the delete token');

      const serialized = JSON.stringify(response.body);
      assert.ok(!serialized.includes(workDir));
      assert.ok(!serialized.includes('deleteToken'));
    });

    it('streams the original bytes with a safe attachment header', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '60' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const { response, body } = await downloadBuffer(upload.token);

      assert.equal(response.status, 200);
      assert.deepEqual(body, readFileSync(fixture('sample.pdf')));
      assert.match(String(response.headers['content-disposition']), /^attachment;/);
      assert.match(String(response.headers['content-disposition']), /sample\.pdf/);
      assert.equal(String(response.headers['content-type']), 'application/octet-stream');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
    });

    it('never exposes delete tokens in the recent uploads response', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload?.deleteToken);

      const response = await api.get('/api/uploads/recent');
      assert.equal(response.status, 200);
      const serialized = JSON.stringify(response.body);

      assert.ok(!serialized.includes('deleteToken'));
      assert.ok(!serialized.includes(upload.deleteToken as string));
    });

    it('returns 404 for an unknown share token', async () => {
      const response = await api.get('/api/download/not-a-real-token');
      assert.equal(response.status, 404);
    });

    it('lists recent active uploads', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'), { expiresInMinutes: '1440' });
      const token = (uploaded.body as UploadBody).uploads[0]?.token;
      assert.ok(token);

      const response = await api.get('/api/uploads/recent');
      assert.equal(response.status, 200);
      const uploads = (response.body as { uploads: ApiUpload[] }).uploads;
      assert.ok(uploads.some((upload) => upload.token === token));
      assert.ok(uploads.length <= 6);
      assert.ok(uploads.every((upload) => upload.deleteToken === undefined));
    });
  });

  describe('one-time download', () => {
    it('deletes the file and row only after a completed download', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const storedPath = storedFileFor(upload);
      assert.ok(existsSync(storedPath));

      const first = await downloadBuffer(upload.token);
      assert.equal(first.response.status, 200);
      assert.deepEqual(first.body, readFileSync(fixture('sample.pdf')));

      await delay(150);
      assert.equal(existsSync(storedPath), false);
      assert.equal(rowFor(upload.token), undefined);

      const second = await downloadBuffer(upload.token);
      assert.equal(second.response.status, 404);
    });

    it('does not delete when the link is only inspected', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const metadata = await api.get(`/api/files/${upload.token}`);
      assert.equal(metadata.status, 200);
      await delay(100);

      assert.ok(rowFor(upload.token));
      assert.ok(existsSync(storedFileFor(upload)));
    });

    it('keeps the file when the download is interrupted', async () => {
      const bigPath = path.join(workDir, 'interrupt-me.bin');
      writeFileSync(bigPath, Buffer.alloc(8 * 1024 * 1024, 0x41));

      const uploaded = await uploadOne(bigPath, { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const server = await startServer();
      try {
        await new Promise<void>((resolve) => {
          const request = httpGet(
            `http://127.0.0.1:${server.port}/api/download/${upload.token}`,
            (response) => {
              response.once('data', () => {
                request.destroy();
                resolve();
              });
              response.resume();
            },
          );
          request.on('error', () => resolve());
        });
        await delay(300);
      } finally {
        await server.close();
      }

      const row = rowFor(upload.token);
      assert.ok(row, 'record must survive an interrupted download');
      assert.equal(row.pending_delete, 0);
      assert.ok(row.download_count >= 1);
      assert.ok(existsSync(storedFileFor(upload)));

      const retry = await downloadBuffer(upload.token);
      assert.equal(retry.response.status, 200);
      assert.equal(retry.body.length, 8 * 1024 * 1024);
    });

    it('retains the record when storage refuses deletion, then retries', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const storedPath = storedFileFor(upload);
      const contents = readFileSync(fixture('sample.pdf'));
      assert.ok(existsSync(storedPath));

      chmodSync(storageFilesDir, 0o500); // directory not writable → unlink fails
      try {
        const response = await downloadBuffer(upload.token);
        assert.equal(response.response.status, 200);
        assert.deepEqual(response.body, contents);
        // Let the server's post-transfer deletion attempt run while the
        // directory is still read-only.
        await delay(300);
      } finally {
        chmodSync(storageFilesDir, 0o755);
      }

      const row = rowFor(upload.token);
      assert.ok(row, 'record must be retained when storage deletion fails');
      assert.equal(row.pending_delete, 1);
      assert.ok(existsSync(storedPath));

      const blocked = await downloadBuffer(upload.token);
      assert.equal(blocked.response.status, 404);

      const cleanup = await cleanupExpiredUploads();
      assert.ok(cleanup.removed >= 1);
      assert.equal(rowFor(upload.token), undefined);
      assert.equal(existsSync(storedPath), false);
    });

    it('serves simultaneous downloads consistently, then deletes once', async () => {
      const bytes = Buffer.alloc(2 * 1024 * 1024, 0x37);
      const bigPath = path.join(workDir, 'parallel.bin');
      writeFileSync(bigPath, bytes);

      const uploaded = await uploadOne(bigPath, { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const storedPath = storedFileFor(upload);
      const results = await Promise.all([
        downloadBuffer(upload.token),
        downloadBuffer(upload.token),
        downloadBuffer(upload.token),
      ]);

      for (const result of results) {
        assert.equal(result.response.status, 200);
        assert.equal(result.body.length, bytes.length);
        assert.ok(result.body.equals(bytes));
      }

      await delay(150);
      assert.equal(existsSync(storedPath), false);
      assert.equal(rowFor(upload.token), undefined);

      const after = await downloadBuffer(upload.token);
      assert.equal(after.response.status, 404);
    });
  });

  describe('secure deletion', () => {
    it('issues a delete token different from the share token and stores only its hash', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload?.deleteToken);

      assert.notEqual(upload.deleteToken, upload.token);
      assert.ok((upload.deleteToken as string).length >= 32);

      const row = getDatabase()
        .prepare('SELECT delete_token_hash FROM uploads WHERE share_token = ?')
        .get(upload.token) as { delete_token_hash: string | null } | undefined;

      assert.ok(row?.delete_token_hash);
      assert.notEqual(row.delete_token_hash, upload.deleteToken);
      assert.equal(
        row.delete_token_hash,
        createHash('sha256').update(upload.deleteToken as string).digest('hex'),
      );
    });

    it('rejects an invalid delete token', async () => {
      const response = await api.delete('/api/uploads/definitely-not-a-delete-token');
      assert.equal(response.status, 404);
      assert.equal((response.body as ErrorBody).error.code, 'NOT_FOUND');
    });

    it('does not allow deletion with the public share token', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const response = await api.delete(`/api/uploads/${upload.token}`);
      assert.equal(response.status, 404);

      const stillThere = await api.get(`/api/files/${upload.token}`);
      assert.equal(stillThere.status, 200);
    });

    it('deletes the physical file, the row, and disables the share link', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload?.deleteToken);

      const storedPath = storedFileFor(upload);
      assert.ok(existsSync(storedPath));
      const rowsBefore = countRows();

      const response = await api.delete(`/api/uploads/${upload.deleteToken}`);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { deleted: true, filename: 'sample.pdf' });

      assert.equal(existsSync(storedPath), false);
      assert.equal(countRows(), rowsBefore - 1);

      const share = await api.get(`/api/download/${upload.token}`);
      assert.equal(share.status, 404);

      const row = getDatabase()
        .prepare('SELECT id FROM uploads WHERE share_token = ?')
        .get(upload.token);
      assert.equal(row, undefined);
    });

    it('handles repeated deletion sensibly', async () => {
      const uploaded = await uploadOne(fixture('notes.txt'), { expiresInMinutes: '1440' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload?.deleteToken);

      const first = await api.delete(`/api/uploads/${upload.deleteToken}`);
      assert.equal(first.status, 200);

      const second = await api.delete(`/api/uploads/${upload.deleteToken}`);
      assert.equal(second.status, 404);
      assert.match((second.body as ErrorBody).error.message, /already deleted|not valid/i);
    });

    it('keeps the other uploads when one is deleted', async () => {
      const response = await api
        .post('/api/uploads')
        .attach('files', fixture('sample.pdf'))
        .attach('files', fixture('notes.txt'))
        .field('expiresInMinutes', '1440');

      const [first, second] = (response.body as UploadBody).uploads;
      assert.ok(first?.deleteToken && second);

      await api.delete(`/api/uploads/${first.deleteToken}`);

      const survivor = await api.get(`/api/files/${second.token}`);
      assert.equal(survivor.status, 200);
    });
  });

  describe('expiry in minutes', () => {
    it('accepts a 1 minute expiry', async () => {
      const uploaded = await uploadWithMinutes(fixture('notes.txt'), '1');
      assert.equal(uploaded.status, 201);

      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);
      const delta = new Date(upload.expiresAt).getTime() - new Date(upload.createdAt).getTime();
      assert.equal(delta, 60_000);
    });

    it('accepts a 5 minute expiry', async () => {
      const uploaded = await uploadWithMinutes(fixture('notes.txt'), '5');
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);
      const delta = new Date(upload.expiresAt).getTime() - new Date(upload.createdAt).getTime();
      assert.equal(delta, 5 * 60_000);
    });

    it('accepts a custom 45 minute expiry', async () => {
      const uploaded = await uploadWithMinutes(fixture('notes.txt'), '45');
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);
      const delta = new Date(upload.expiresAt).getTime() - new Date(upload.createdAt).getTime();
      assert.equal(delta, 45 * 60_000);
    });

    it('still accepts the legacy presets', async () => {
      const cases: Array<[string, number]> = [
        ['1h', 3_600_000],
        ['24h', 86_400_000],
        ['7d', 604_800_000],
      ];

      for (const [preset, expected] of cases) {
        const uploaded = await uploadOne(fixture('notes.txt'), { expiresIn: preset });
        assert.equal(uploaded.status, 201);
        const upload = (uploaded.body as UploadBody).uploads[0];
        assert.ok(upload);
        const delta = new Date(upload.expiresAt).getTime() - new Date(upload.createdAt).getTime();
        assert.equal(delta, expected);
      }
    });

    it('rejects zero minutes', async () => {
      const response = await uploadWithMinutes(fixture('notes.txt'), '0');
      assert.equal(response.status, 400);
      assert.match((response.body as ErrorBody).error.message, /at least 1 minute/i);
    });

    it('rejects negative minutes', async () => {
      const response = await uploadWithMinutes(fixture('notes.txt'), '-30');
      assert.equal(response.status, 400);
    });

    it('rejects decimal minutes', async () => {
      const response = await uploadWithMinutes(fixture('notes.txt'), '1.5');
      assert.equal(response.status, 400);
      assert.match((response.body as ErrorBody).error.message, /whole number/i);
    });

    it('rejects values above 10080 minutes', async () => {
      const response = await uploadWithMinutes(fixture('notes.txt'), '10081');
      assert.equal(response.status, 400);
      assert.match((response.body as ErrorBody).error.message, /10080/);
    });

    it('rejects non-numeric expiry values', async () => {
      const response = await uploadWithMinutes(fixture('notes.txt'), 'soon');
      assert.equal(response.status, 400);
    });

    it('rejects an unknown preset', async () => {
      const response = await uploadOne(fixture('notes.txt'), { expiresIn: 'never' });
      assert.equal(response.status, 400);
    });

    it('keeps the temp directory clean after an invalid expiry', async () => {
      const tmpBefore = readdirSync(storageTmpDir).length;
      const response = await uploadWithMinutes(fixture('notes.txt'), '0');
      assert.equal(response.status, 400);
      assert.equal(readdirSync(storageTmpDir).length, tmpBefore);
    });

    it('stops serving a link immediately once expiry passes', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '60' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      getDatabase()
        .prepare('UPDATE uploads SET expires_at = ? WHERE share_token = ?')
        .run(new Date(Date.now() - 1_000).toISOString(), upload.token);

      const { response, json } = await downloadBuffer(upload.token);
      assert.equal(response.status, 410);
      assert.equal((json as ErrorBody).error.code, 'EXPIRED');
    });

    it('deletes expired files and rows during cleanup', async () => {
      const uploaded = await uploadOne(fixture('sample.pdf'), { expiresInMinutes: '60' });
      const upload = (uploaded.body as UploadBody).uploads[0];
      assert.ok(upload);

      const storedPath = storedFileFor(upload);
      assert.ok(existsSync(storedPath));

      getDatabase()
        .prepare('UPDATE uploads SET expires_at = ? WHERE share_token = ?')
        .run(new Date(Date.now() - 60_000).toISOString(), upload.token);

      const result = await cleanupExpiredUploads();
      assert.ok(result.removed >= 1);
      assert.equal(existsSync(storedPath), false);

      const row = getDatabase()
        .prepare('SELECT id FROM uploads WHERE share_token = ?')
        .get(upload.token);
      assert.equal(row, undefined);
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

    it('requires at least one file', async () => {
      const response = await api.post('/api/uploads').field('expiresInMinutes', '60');
      assert.equal(response.status, 400);
      assert.equal((response.body as ErrorBody).error.code, 'BAD_REQUEST');
    });
  });
});
